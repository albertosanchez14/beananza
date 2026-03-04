package websocket

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

// Hub maintains the set of active clients, rooms and
// broadcasts messages to clients
type Hub struct {
	config      *config.Config
	clients     map[*Client]bool
	rooms       map[string]*Room
	gameManager *game.Manager
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
	logger      *zap.Logger
	repo        *storage.Repository
	pubsub      *storage.PubSub
}

func NewHub(cfg *config.Config, logger *zap.Logger, repo *storage.Repository, pubsub *storage.PubSub) *Hub {
	return &Hub{
		config:      cfg,
		clients:     make(map[*Client]bool),
		rooms:       make(map[string]*Room),
		gameManager: game.NewManager(cfg, repo, logger),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		logger:      logger,
		repo:        repo,
		pubsub:      pubsub,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			h.logger.Info("client registered",
				zap.String("client_id", client.ID),
				zap.Int("total_clients", len(h.clients)),
			)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				if client.room != nil {
					client.room.Leave(client)
				}

				delete(h.clients, client)
				close(client.send)

				h.logger.Info("client unregistered",
					zap.String("client_id", client.ID),
					zap.Int("total_clients", len(h.clients)),
				)
			}
			h.mu.Unlock()

			h.cleanupEmptyRooms()
		}
	}
}

// GetOrCreateRoom retrieves an existing room or creates a new one
func (h *Hub) GetOrCreateRoom(roomID string) *Room {
	h.mu.Lock()

	if room, ok := h.rooms[roomID]; ok {
		h.mu.Unlock()
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
		zap.Int("total_rooms", len(h.rooms)),
	)

	// Release the lock before subscribing: Subscribe blocks on a Redis
	// round-trip (sub.Receive) and holding h.mu would deadlock any
	// concurrent read (e.g. GET /rooms) for the duration of that call.
	h.mu.Unlock()

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

// GetRoom retrieves an existing room
func (h *Hub) GetRoom(roomID string) *Room {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[roomID]
}

// cleanupEmptyRooms removes rooms that have no clients
func (h *Hub) cleanupEmptyRooms() {
	h.mu.Lock()

	var toDelete []string
	for roomID, room := range h.rooms {
		if room.IsEmpty() {
			toDelete = append(toDelete, roomID)
			delete(h.rooms, roomID)
			h.gameManager.RemoveSession(roomID)
		}
	}

	h.mu.Unlock()

	for _, roomID := range toDelete {
		// Unsubscribe from Redis pub/sub
		if h.pubsub != nil {
			if err := h.pubsub.Unsubscribe(roomID); err != nil {
				h.logger.Error("failed to unsubscribe from room channel",
					zap.String("room_id", roomID),
					zap.Error(err),
				)
			}
		}

		// Remove from the shared room registry
		if h.repo != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_ = h.repo.DeleteRoomInfo(ctx, roomID)
			cancel()
		}

		h.logger.Info("room deleted", zap.String("room_id", roomID))
	}
}

// Register adds a client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// GetStats returns statistics about the hub
func (h *Hub) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	roomStats := make([]map[string]interface{}, 0, len(h.rooms))
	for roomID, room := range h.rooms {
		roomStats = append(roomStats, map[string]interface{}{
			"room_id":      roomID,
			"client_count": room.ClientCount(),
		})
	}

	return map[string]interface{}{
		"total_clients": len(h.clients),
		"total_rooms":   len(h.rooms),
		"rooms":         roomStats,
	}
}

// GetRoomList returns a snapshot of all active rooms.
// When a Redis repository is configured it reads from the shared registry
// so every instance returns the full cross-instance list.
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

	// Fallback: local rooms only (no Redis configured)
	h.mu.RLock()
	defer h.mu.RUnlock()

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

// handlePubSubMessage forwards a message received from Redis to local room clients
func (h *Hub) handlePubSubMessage(roomID string, message []byte) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()

	if !ok || room == nil {
		h.logger.Debug("received pub/sub message for non-existent room",
			zap.String("room_id", roomID),
		)
		return
	}

	// Decode the message type so we can react to lobby-mutating events.
	decoded, err := protocol.FromJSON(message)
	if err == nil {
		switch decoded.Type {
		case protocol.MessageTypeBroadcast:
			var bp protocol.BroadcastPayload
			if decoded.ParsePayload(&bp) == nil {
				if bp.Event == "player_joined" || bp.Event == "player_left" || bp.Event == "player_ready" {
					// Another instance mutated the lobby — push a fresh snapshot
					// from Redis to every local client so they see the full list.
					go h.BroadcastWaitingLobbyToRoom(roomID)
					return
				}
				if bp.Event == "game_started" {
					// Another instance started the game — forward the broadcast so
					// clients know the game began, then push each client their own
					// personalised game state loaded from Redis.
					room.HandleIncomingMessage(message)
					go h.BroadcastGameStateToRoom(roomID)
					return
				}
				if bp.Event == "state_updated" {
					// A game action was processed on another instance — push fresh
					// personalised snapshots to local clients without forwarding
					// the internal event to browsers.
					go h.BroadcastGameStateToRoom(roomID)
					return
				}
			}
		}
	}

	room.HandleIncomingMessage(message)
}

// BroadcastGameStateToRoom reloads the game session from Redis so this instance
// has the latest state, then pushes each local client their personalised
// myState snapshot. Call this when a game_started event arrives via pub/sub
// from another instance.
func (h *Hub) BroadcastGameStateToRoom(roomID string) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	// Reload from Redis so this instance picks up the game state written by
	// whichever instance actually started the game.
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
// player count and session state for the given room. Call this after any
// join or leave event so the /rooms listing stays accurate across instances.
func (h *Hub) SyncRoomRegistry(roomID string) {
	if h.repo == nil {
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
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

// BroadcastWaitingLobbyToRoom reloads the session from Redis so it has the
// latest cross-instance state, then sends a fresh waitingLobbyState to every
// local client in the room. Call this after any join/leave/ready mutation.
func (h *Hub) BroadcastWaitingLobbyToRoom(roomID string) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	// Force a reload from Redis so this instance sees players that joined
	// on other instances.
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
