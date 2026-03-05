package websocket

// hub.go — central connection manager.
//
// Lock ordering (MUST be respected everywhere to prevent deadlock):
//   1. clientsMu — guards the clients map
//   2. roomsMu   — guards the rooms map
//
// Never acquire clientsMu while holding roomsMu.
// Never acquire roomsMu while holding clientsMu.
// Always acquire at most one of the two locks at a time.
// session.mu (game.Session) is always acquired AFTER both hub locks are released.

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/game"
	"github.com/yourusername/game-server/internal/storage"
	"github.com/yourusername/game-server/pkg/protocol"
)

// RoomInfo is a snapshot of a room used by the REST rooms listing endpoint.
type RoomInfo struct {
	ID           string `json:"id"`
	PlayerCount  int    `json:"player_count"`
	MaxPlayers   int    `json:"max_players"`
	SessionState string `json:"session_state"`
}

// fanoutEvent is queued on the fanout channel by action handlers so that the
// hub's Run() loop can push personalised state to local clients asynchronously,
// decoupling the read pump from the O(N) broadcast work.
type fanoutEvent struct {
	roomID  string
	session *game.Session
}

// Hub maintains the set of active clients, rooms, and broadcasts messages to
// clients.  It uses two independent mutexes to reduce contention:
//   - clientsMu protects the clients map
//   - roomsMu   protects the rooms map
type Hub struct {
	config      *config.Config
	clients     map[*Client]bool
	rooms       map[string]*Room
	gameManager *game.Manager
	register    chan *Client
	unregister  chan *Client
	// fanout receives broadcast requests from action handlers.
	// Processed by Run() to avoid blocking the calling goroutine.
	fanout    chan fanoutEvent
	clientsMu sync.RWMutex
	roomsMu   sync.RWMutex
	logger    *zap.Logger
	repo      *storage.Repository
	pubsub    *storage.PubSub
}

func NewHub(cfg *config.Config, logger *zap.Logger, repo *storage.Repository, pubsub *storage.PubSub) *Hub {
	return &Hub{
		config:      cfg,
		clients:     make(map[*Client]bool),
		rooms:       make(map[string]*Room),
		gameManager: game.NewManager(cfg, repo, logger),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		fanout:      make(chan fanoutEvent, 64),
		logger:      logger,
		repo:        repo,
		pubsub:      pubsub,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clientsMu.Lock()
			h.clients[client] = true
			h.clientsMu.Unlock()

			h.logger.Info("client registered",
				zap.String("client_id", client.ID),
			)

		case client := <-h.unregister:
			h.clientsMu.Lock()
			if _, ok := h.clients[client]; ok {
				if client.room != nil {
					client.room.Leave(client)
				}
				delete(h.clients, client)
				close(client.send)

				h.logger.Info("client unregistered",
					zap.String("client_id", client.ID),
				)
			}
			h.clientsMu.Unlock()

			h.cleanupEmptyRooms()

		case ev := <-h.fanout:
			// Asynchronous fan-out: push personalised snapshots to all local
			// clients in the room.  This runs in the hub goroutine so the
			// client's ReadPump is never blocked by O(N) marshalling work.
			h.roomsMu.RLock()
			room, ok := h.rooms[ev.roomID]
			h.roomsMu.RUnlock()
			if !ok {
				continue
			}
			for _, client := range room.GetClients() {
				playerSnapshot := ev.session.GetPlayerSnapshot(client.PlayerId)
				msg, err := protocol.NewMessage(
					protocol.MessageTypePlayerState,
					ev.roomID,
					client.PlayerId,
					playerSnapshot,
				)
				if err != nil {
					h.logger.Error("fanout: failed to create player state message", zap.Error(err))
					continue
				}
				data, err := msg.ToJSON()
				if err != nil {
					h.logger.Error("fanout: failed to marshal player state message", zap.Error(err))
					continue
				}
				client.Send(data)
			}
		}
	}
}

// EnqueueFanout queues a personalised-state broadcast for all clients in the
// room.  The broadcast is processed asynchronously by Run() so the caller
// (typically a client's ReadPump) is not blocked.
func (h *Hub) EnqueueFanout(roomID string, session *game.Session) {
	select {
	case h.fanout <- fanoutEvent{roomID: roomID, session: session}:
	default:
		h.logger.Warn("fanout channel full, dropping snapshot broadcast",
			zap.String("room_id", roomID),
		)
	}
}

// GetOrCreateRoom retrieves an existing room or creates a new one.
func (h *Hub) GetOrCreateRoom(roomID string) *Room {
	h.roomsMu.Lock()

	if room, ok := h.rooms[roomID]; ok {
		h.roomsMu.Unlock()
		return room
	}

	handler := func(message []byte) {
		h.handlePubSubMessage(roomID, message)
	}

	room := NewRoom(roomID, h.logger, handler)
	h.rooms[roomID] = room

	if h.pubsub != nil {
		room.SetBroadcastFn(func(rid string, data []byte) {
			h.pubsub.Publish(rid, data)
		})
	}

	h.logger.Info("room created",
		zap.String("room_id", roomID),
	)

	// Release the lock before subscribing: Subscribe blocks on a Redis
	// round-trip (sub.Receive) and holding roomsMu for the duration of that
	// call would stall every concurrent room lookup.
	h.roomsMu.Unlock()

	if h.pubsub != nil {
		if err := h.pubsub.Subscribe(roomID, func(rid string, msg []byte) { handler(msg) }); err != nil {
			h.logger.Error("failed to subscribe to room channel",
				zap.String("room_id", roomID),
				zap.Error(err),
			)
		}
	}

	// Register the room in the shared Redis registry so any instance can
	// serve the full room list via GET /rooms.
	if h.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = h.repo.UpsertRoomInfo(ctx, storage.RoomMeta{
			ID:           roomID,
			PlayerCount:  0,
			MaxPlayers:   h.config.Game.MaxNumberPlayers,
			SessionState: "waiting",
		})
	}

	return room
}

// GetRoom retrieves an existing room without creating one.
func (h *Hub) GetRoom(roomID string) *Room {
	h.roomsMu.RLock()
	defer h.roomsMu.RUnlock()
	return h.rooms[roomID]
}

// cleanupEmptyRooms removes rooms that have no clients.
func (h *Hub) cleanupEmptyRooms() {
	h.roomsMu.Lock()

	var toDelete []string
	for roomID, room := range h.rooms {
		if room.IsEmpty() {
			toDelete = append(toDelete, roomID)
			delete(h.rooms, roomID)
			h.gameManager.RemoveSession(roomID)
		}
	}

	h.roomsMu.Unlock()

	for _, roomID := range toDelete {
		if h.pubsub != nil {
			if err := h.pubsub.Unsubscribe(roomID); err != nil {
				h.logger.Error("failed to unsubscribe from room channel",
					zap.String("room_id", roomID),
					zap.Error(err),
				)
			}
		}

		if h.repo != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = h.repo.DeleteRoomInfo(ctx, roomID)
			cancel()
		}

		h.logger.Info("room deleted", zap.String("room_id", roomID))
	}
}

// Register adds a client to the hub.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// GetStats returns statistics about the hub.
func (h *Hub) GetStats() map[string]interface{} {
	h.clientsMu.RLock()
	totalClients := len(h.clients)
	h.clientsMu.RUnlock()

	h.roomsMu.RLock()
	roomStats := make([]map[string]interface{}, 0, len(h.rooms))
	for roomID, room := range h.rooms {
		roomStats = append(roomStats, map[string]interface{}{
			"room_id":      roomID,
			"client_count": room.ClientCount(),
		})
	}
	totalRooms := len(h.rooms)
	h.roomsMu.RUnlock()

	return map[string]interface{}{
		"total_clients": totalClients,
		"total_rooms":   totalRooms,
		"rooms":         roomStats,
	}
}

// GetRoomList returns a snapshot of all active rooms.
// When a Redis repository is configured it reads from the shared registry so
// every instance returns the full cross-instance list.
func (h *Hub) GetRoomList() []RoomInfo {
	if h.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		metas, err := h.repo.GetAllRooms(ctx)
		if err == nil {
			rooms := make([]RoomInfo, 0, len(metas))
			for _, m := range metas {
				rooms = append(rooms, RoomInfo{
					ID:           m.ID,
					PlayerCount:  m.PlayerCount,
					MaxPlayers:   m.MaxPlayers,
					SessionState: m.SessionState,
				})
			}
			return rooms
		}
		h.logger.Warn("failed to read room list from redis, falling back to local", zap.Error(err))
	}

	// Fallback: local rooms only (no Redis configured).
	h.roomsMu.RLock()
	defer h.roomsMu.RUnlock()

	rooms := make([]RoomInfo, 0, len(h.rooms))
	for roomID, room := range h.rooms {
		state := h.gameManager.GetSessionState(roomID)
		rooms = append(rooms, RoomInfo{
			ID:           roomID,
			PlayerCount:  room.ClientCount(),
			MaxPlayers:   h.config.Game.MaxNumberPlayers,
			SessionState: string(state),
		})
	}
	return rooms
}

// handlePubSubMessage forwards a message received from Redis to local room clients.
func (h *Hub) handlePubSubMessage(roomID string, message []byte) {
	h.roomsMu.RLock()
	room, ok := h.rooms[roomID]
	h.roomsMu.RUnlock()

	if !ok || room == nil {
		h.logger.Debug("received pub/sub message for non-existent room",
			zap.String("room_id", roomID),
		)
		return
	}

	decoded, err := protocol.FromJSON(message)
	if err == nil {
		switch decoded.Type {
		case protocol.MessageTypeBroadcast:
			var bp protocol.BroadcastPayload
			if decoded.ParsePayload(&bp) == nil {
				if bp.Event == protocol.EventPlayerJoined || bp.Event == protocol.EventPlayerLeft || bp.Event == protocol.EventPlayerReady {
					go h.BroadcastWaitingLobbyToRoom(roomID)
					return
				}
				if bp.Event == protocol.EventGameStarted {
					room.HandleIncomingMessage(message)
					go h.BroadcastGameStateToRoom(roomID)
					return
				}
				if bp.Event == protocol.EventStateUpdated {
					go h.BroadcastGameStateToRoom(roomID)
					return
				}
			}
		}
	}

	room.HandleIncomingMessage(message)
}

// BroadcastGameStateToRoom reloads the game session from Redis so this instance
// has the latest state, then pushes each local client their personalised myState.
func (h *Hub) BroadcastGameStateToRoom(roomID string) {
	h.roomsMu.RLock()
	room, ok := h.rooms[roomID]
	h.roomsMu.RUnlock()
	if !ok {
		return
	}

	session := h.gameManager.GetOrCreateSession(roomID)
	if h.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := session.LoadFromStorage(ctx); err != nil {
			h.logger.Warn("failed to reload session for game state broadcast",
				zap.String("room_id", roomID),
				zap.Error(err),
			)
		}
	}

	for _, client := range room.GetClients() {
		playerSnapshot := session.GetPlayerSnapshot(client.PlayerId)
		msg, err := protocol.NewMessage(
			protocol.MessageTypePlayerState,
			roomID,
			client.PlayerId,
			playerSnapshot,
		)
		if err != nil {
			h.logger.Error("failed to create player state message", zap.Error(err))
			continue
		}
		data, err := msg.ToJSON()
		if err != nil {
			h.logger.Error("failed to marshal player state message", zap.Error(err))
			continue
		}
		client.Send(data)
	}
}

// SyncRoomRegistry updates the shared Redis room registry with the current
// player count and session state for the given room.
func (h *Hub) SyncRoomRegistry(roomID string) {
	if h.repo == nil {
		return
	}

	h.roomsMu.RLock()
	room, ok := h.rooms[roomID]
	h.roomsMu.RUnlock()
	if !ok {
		return
	}

	state := h.gameManager.GetSessionState(roomID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = h.repo.UpsertRoomInfo(ctx, storage.RoomMeta{
		ID:           roomID,
		PlayerCount:  room.ClientCount(),
		MaxPlayers:   h.config.Game.MaxNumberPlayers,
		SessionState: string(state),
	})
}

// BroadcastWaitingLobbyToRoom reloads the session from Redis then sends a
// fresh waitingLobbyState to every local client in the room.
func (h *Hub) BroadcastWaitingLobbyToRoom(roomID string) {
	h.roomsMu.RLock()
	room, ok := h.rooms[roomID]
	h.roomsMu.RUnlock()
	if !ok {
		return
	}

	session := h.gameManager.GetOrCreateSession(roomID)
	if h.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := session.LoadFromStorage(ctx); err != nil {
			h.logger.Warn("failed to reload session for lobby broadcast",
				zap.String("room_id", roomID),
				zap.Error(err),
			)
		}
	}

	snapshot := session.GetWaitingLobbySnapshot()

	for _, client := range room.GetClients() {
		msg, err := protocol.NewMessage(
			protocol.WaitingLobbyState,
			roomID,
			client.PlayerId,
			snapshot,
		)
		if err != nil {
			h.logger.Error("failed to create waitingLobbyState message", zap.Error(err))
			continue
		}
		data, err := msg.ToJSON()
		if err != nil {
			h.logger.Error("failed to marshal waitingLobbyState message", zap.Error(err))
			continue
		}
		client.Send(data)
	}
}
