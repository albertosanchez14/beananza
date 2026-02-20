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
}

// NewRoom creates a new room
func NewRoom(id string, logger *zap.Logger) *Room {
	return &Room{
		ID:      id,
		clients: make(map[*Client]bool),
		logger:  logger.With(zap.String("room_id", id)),
	}
}

func (r *Room) Join(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.clients[client] = true
	r.logger.Info("client joined room",
		zap.String("client_id", client.ID),
		zap.String("player_name", client.PlayerName),
		zap.Int("total_clients", len(r.clients)),
	)

	joinMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		r.ID,
		client.PlayerID,
		protocol.BroadcastPayload{
			Event: "player_joined",
			Data: map[string]interface{}{
				"player_id":   client.PlayerID,
				"player_name": client.PlayerName,
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
	defer r.mu.Unlock()

	if _, ok := r.clients[client]; !ok {
		return
	}

	delete(r.clients, client)
	r.logger.Info("client left room",
		zap.String("client_id", client.ID),
		zap.Int("total_clients", len(r.clients)),
	)

	leaveMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		r.ID,
		client.PlayerID,
		protocol.BroadcastPayload{
			Event: "player_left",
			Data: map[string]interface{}{
				"player_id":   client.PlayerID,
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
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := msg.ToJSON()
	if err != nil {
		r.logger.Error("failed to marshal message", zap.Error(err))
		return
	}

	for client := range r.clients {
		client.Send(data)
	}

	r.logger.Debug("message broadcasted",
		zap.String("message_type", string(msg.Type)),
		zap.String("sender_id", sender.ID),
		zap.Int("recipient_count", len(r.clients)),
	)
}

func (r *Room) broadcastToOthers(msg *protocol.Message, sender *Client) {
	data, err := msg.ToJSON()
	if err != nil {
		r.logger.Error("failed to marshal message", zap.Error(err))
		return
	}

	for client := range r.clients {
		if client != sender {
			client.Send(data)
		}
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
