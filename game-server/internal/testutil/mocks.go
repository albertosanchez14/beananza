package testutil

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// MockRepository is an in-memory implementation of storage.Repository for testing
type MockRepository struct {
	states   map[string]interface{}
	messages map[string]map[string]interface{} // roomID -> messageID -> message
	players  map[string]map[string]bool        // roomID -> playerID -> exists
	mu       sync.RWMutex
}

// NewMockRepository creates a new mock repository
func NewMockRepository() *MockRepository {
	return &MockRepository{
		states:   make(map[string]interface{}),
		messages: make(map[string]map[string]interface{}),
		players:  make(map[string]map[string]bool),
	}
}

// SaveMessage stores a message in memory
func (m *MockRepository) SaveMessage(ctx context.Context, roomID, messageID string, data interface{}, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.messages[roomID] == nil {
		m.messages[roomID] = make(map[string]interface{})
	}

	m.messages[roomID][messageID] = data
	return nil
}

// GetMessage retrieves a message from memory
func (m *MockRepository) GetMessage(ctx context.Context, roomID, messageID string, dest interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	roomMessages, ok := m.messages[roomID]
	if !ok {
		return fmt.Errorf("message not found")
	}

	data, ok := roomMessages[messageID]
	if !ok {
		return fmt.Errorf("message not found")
	}

	// Marshal and unmarshal to simulate Redis behavior
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return json.Unmarshal(jsonData, dest)
}

// SaveGameState stores game state in memory
func (m *MockRepository) SaveGameState(ctx context.Context, roomID string, state interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.states[roomID] = state
	return nil
}

// GetGameState retrieves game state from memory
func (m *MockRepository) GetGameState(ctx context.Context, roomID string, dest interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state, ok := m.states[roomID]
	if !ok {
		return fmt.Errorf("game state not found")
	}

	// Marshal and unmarshal to simulate Redis behavior
	jsonData, err := json.Marshal(state)
	if err != nil {
		return err
	}

	return json.Unmarshal(jsonData, dest)
}

// AddPlayerToRoom adds a player to a room
func (m *MockRepository) AddPlayerToRoom(ctx context.Context, roomID, playerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.players[roomID] == nil {
		m.players[roomID] = make(map[string]bool)
	}

	m.players[roomID][playerID] = true
	return nil
}

// RemovePlayerFromRoom removes a player from a room
func (m *MockRepository) RemovePlayerFromRoom(ctx context.Context, roomID, playerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.players[roomID] != nil {
		delete(m.players[roomID], playerID)
	}

	return nil
}

// GetRoomPlayers gets all players in a room
func (m *MockRepository) GetRoomPlayers(ctx context.Context, roomID string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	players := make([]string, 0)
	if roomPlayers, ok := m.players[roomID]; ok {
		for playerID := range roomPlayers {
			players = append(players, playerID)
		}
	}

	return players, nil
}

// Close is a no-op for mock
func (m *MockRepository) Close() error {
	return nil
}

// Test helper methods

// GetSavedState retrieves a saved state (test helper)
func (m *MockRepository) GetSavedState(roomID string) (interface{}, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state, ok := m.states[roomID]
	return state, ok
}

// GetSavedMessages retrieves all saved messages for a room (test helper)
func (m *MockRepository) GetSavedMessages(roomID string) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if messages, ok := m.messages[roomID]; ok {
		// Return a copy
		result := make(map[string]interface{})
		for k, v := range messages {
			result[k] = v
		}
		return result
	}

	return make(map[string]interface{})
}

// Clear resets all data (test helper)
func (m *MockRepository) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.states = make(map[string]interface{})
	m.messages = make(map[string]map[string]interface{})
	m.players = make(map[string]map[string]bool)
}

// HasState checks if a state exists for a room (test helper)
func (m *MockRepository) HasState(roomID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	_, ok := m.states[roomID]
	return ok
}

// PlayerCount returns the number of players in a room (test helper)
func (m *MockRepository) PlayerCount(roomID string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if players, ok := m.players[roomID]; ok {
		return len(players)
	}
	return 0
}
