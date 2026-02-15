package websocket

import (
	"sync"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/pkg/protocol"
)

// Room represents a game room where multiple clients can interact
type Room struct {
	// Unique room identifier
	ID string

	// Registered clients in this room
	clients map[*Client]bool

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Logger for this room
	logger *zap.Logger
}

// NewRoom creates a new room
func NewRoom(id string, logger *zap.Logger) *Room {
	return &Room{
		ID:      id,
		clients: make(map[*Client]bool),
		logger:  logger.With(zap.String("room_id", id)),
	}
}

// Join adds a client to the room
func (r *Room) Join(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.clients[client] = true
	r.logger.Info("client joined room",
		zap.String("client_id", client.ID),
		zap.String("player_name", client.PlayerName),
		zap.Int("total_clients", len(r.clients)),
	)

	// Notify other clients about the new player
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

// Leave removes a client from the room
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

	// Notify other clients about the player leaving
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

// Broadcast sends a message to all clients in the room
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

// broadcastToOthers sends a message to all clients except the sender
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

// ClientCount returns the number of clients in the room
func (r *Room) ClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

// GetClients returns a slice of all clients in the room
func (r *Room) GetClients() []*Client {
	r.mu.RLock()
	defer r.mu.RUnlock()

	clients := make([]*Client, 0, len(r.clients))
	for client := range r.clients {
		clients = append(clients, client)
	}
	return clients
}

// IsEmpty checks if the room has no clients
func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients) == 0
}
