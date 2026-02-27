package game

import (
	"sync"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/storage"
)

// Manager manages all game sessions across different rooms
type Manager struct {
	sessions map[string]*Session
	repo     *storage.Repository
	logger   *zap.Logger
	mu       sync.RWMutex
}

// NewManager creates a new game manager
func NewManager(repo *storage.Repository, logger *zap.Logger) *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
		repo:     repo,
		logger:   logger,
	}
}

// GetOrCreateSession retrieves or creates a game session for a room
func (m *Manager) GetOrCreateSession(roomID string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()

	if session, ok := m.sessions[roomID]; ok {
		return session
	}

	session := NewSession(roomID, m.repo, m.logger)
	m.sessions[roomID] = session

	m.logger.Info("game session created",
		zap.String("room_id", roomID),
	)

	return session
}

// GetSession retrieves an existing game session
func (m *Manager) GetSession(roomID string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, ok := m.sessions[roomID]
	return session, ok
}

// RemoveSession removes a game session
func (m *Manager) RemoveSession(roomID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.sessions, roomID)

	m.logger.Info("game session removed",
		zap.String("room_id", roomID),
		zap.Int("active_sessions", len(m.sessions)),
	)
}

// SessionCount returns the number of active sessions
func (m *Manager) SessionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}
