package websocket

import (
	"sync"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/storage"
)

// Hub maintains the set of active clients and broadcasts messages to clients
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Active rooms
	rooms map[string]*Room

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Logger
	logger *zap.Logger

	// Repository for persistence
	repo *storage.Repository
}

// NewHub creates a new Hub
func NewHub(logger *zap.Logger, repo *storage.Repository) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]*Room),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		logger:     logger,
		repo:       repo,
	}
}

// Run starts the hub's main loop
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
				// Remove from room if present
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

			// Clean up empty rooms
			h.cleanupEmptyRooms()
		}
	}
}

// GetOrCreateRoom retrieves an existing room or creates a new one
func (h *Hub) GetOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[roomID]; ok {
		return room
	}

	room := NewRoom(roomID, h.logger)
	h.rooms[roomID] = room

	h.logger.Info("room created",
		zap.String("room_id", roomID),
		zap.Int("total_rooms", len(h.rooms)),
	)

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
	defer h.mu.Unlock()

	for roomID, room := range h.rooms {
		if room.IsEmpty() {
			delete(h.rooms, roomID)
			h.logger.Info("room deleted",
				zap.String("room_id", roomID),
				zap.Int("total_rooms", len(h.rooms)),
			)
		}
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
