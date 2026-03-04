package websocket

import (
	"sync"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/pkg/protocol"
)

// Room represents a game room where multiple clients can interact
type Room struct {
	ID      string
	clients map[*Client]bool
	mu      sync.RWMutex
	logger  *zap.Logger

	onMessage   func(message []byte)
	broadcastFn func(roomID string, data []byte)
}

func NewRoom(id string, logger *zap.Logger, onMessage func(message []byte)) *Room {
	return &Room{
		ID:        id,
		clients:   make(map[*Client]bool),
		logger:    logger.With(zap.String("room_id", id)),
		onMessage: onMessage,
	}
}

func (r *Room) SetBroadcastFn(fn func(roomID string, data []byte)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.broadcastFn = fn
}

func (r *Room) Join(client *Client) {
	r.mu.Lock()
	r.clients[client] = true
	r.logger.Info("client joined room",
		zap.String("client_id", client.ID),
		zap.String("player_name", client.PlayerName),
		zap.Int("total_clients", len(r.clients)),
	)
	r.mu.Unlock()

	joinMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		r.ID,
		client.PlayerId,
		protocol.BroadcastPayload{
			Event: "player_joined",
			Data: map[string]any{
				"player_id":   client.PlayerId,
				"player_name": client.PlayerName,
				"ready":       false,
			},
		},
	)
	if err != nil {
		r.logger.Error("failed to create join broadcast", zap.Error(err))
		return
	}

	r.broadcastToOthers(joinMsg, client)
}

func (r *Room) Leave(client *Client) {
	r.mu.Lock()
	if _, ok := r.clients[client]; !ok {
		r.mu.Unlock()
		return
	}
	delete(r.clients, client)
	r.logger.Info("client left room",
		zap.String("client_id", client.ID),
		zap.Int("total_clients", len(r.clients)),
	)
	r.mu.Unlock()

	leaveMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		r.ID,
		client.PlayerId,
		protocol.BroadcastPayload{
			Event: "player_left",
			Data: map[string]any{
				"player_id":   client.PlayerId,
				"player_name": client.PlayerName,
			},
		},
	)
	if err != nil {
		r.logger.Error("failed to create leave broadcast", zap.Error(err))
		return
	}

	r.broadcastToOthers(leaveMsg, client)
}

func (r *Room) Broadcast(msg *protocol.Message, sender *Client) {
	data, err := msg.ToJSON()
	if err != nil {
		r.logger.Error("failed to marshal message", zap.Error(err))
		return
	}

	r.mu.RLock()
	hasClients := len(r.clients) > 0
	broadcastFn := r.broadcastFn
	r.mu.RUnlock()

	if broadcastFn != nil {
		broadcastFn(r.ID, data)
	}

	r.logger.Debug("message broadcasted via pub/sub",
		zap.String("message_type", string(msg.Type)),
		zap.String("sender_id", sender.ID),
		zap.Bool("has_local_clients", hasClients),
	)
}

func (r *Room) broadcastToOthers(msg *protocol.Message, sender *Client) {
	data, err := msg.ToJSON()
	if err != nil {
		r.logger.Error("failed to marshal message", zap.Error(err))
		return
	}

	r.mu.RLock()
	broadcastFn := r.broadcastFn
	r.mu.RUnlock()

	if broadcastFn != nil {
		broadcastFn(r.ID, data)
	}
}

func (r *Room) ClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

func (r *Room) GetClients() []*Client {
	r.mu.RLock()
	defer r.mu.RUnlock()

	clients := make([]*Client, 0, len(r.clients))
	for client := range r.clients {
		clients = append(clients, client)
	}
	return clients
}

func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients) == 0
}

func (r *Room) HandleIncomingMessage(data []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.clients {
		client.Send(data)
	}

	r.logger.Debug("forwarded pub/sub message to local clients",
		zap.Int("recipient_count", len(r.clients)),
	)
}
