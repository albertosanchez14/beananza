package testutil

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/game"
	ws "github.com/yourusername/game-server/internal/websocket"
)

// TestServer wraps a test HTTP server with WebSocket support
type TestServer struct {
	Server     *httptest.Server
	Hub        *ws.Hub
	GameMgr    *game.Manager
	Repository *MockRepository
	URL        string
	logger     *zap.Logger
	t          *testing.T
}

// ServerOption is a functional option for configuring TestServer
type ServerOption func(*TestServer)

// WithRepository sets a custom repository
func WithRepository(repo *MockRepository) ServerOption {
	return func(s *TestServer) {
		s.Repository = repo
	}
}

// WithLogger sets a custom logger
func WithLogger(logger *zap.Logger) ServerOption {
	return func(s *TestServer) {
		s.logger = logger
	}
}

// CreateTestServer creates a fully configured test WebSocket server
func CreateTestServer(t *testing.T, opts ...ServerOption) (*TestServer, error) {
	t.Helper()

	// Create default logger (no-op logger for tests)
	logger := zap.NewNop()

	// Create mock repository
	repo := NewMockRepository()

	// Create test server with defaults
	testServer := &TestServer{
		Repository: repo,
		logger:     logger,
		t:          t,
	}

	// Apply options
	for _, opt := range opts {
		opt(testServer)
	}

	// For testing, we pass nil repository to Hub since it checks for nil before using it
	// The Hub's internal game manager will also use nil repository
	// This avoids needing Redis during tests
	hub := ws.NewHub(testServer.logger, nil)
	testServer.Hub = hub

	// The game manager is created internally by the hub
	// We can access it through the hub's gameManager field (though it's private)
	// For now, we'll rely on the hub's GetOrCreateSession methods
	// Create a separate game manager for direct test access with nil repo
	testServer.GameMgr = game.NewManager(nil, testServer.logger)

	// Start hub in background
	go hub.Run()

	// Create WebSocket upgrader
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins in tests
		},
	}

	// Create HTTP handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/ws" {
			http.NotFound(w, r)
			return
		}

		// Upgrade to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Logf("websocket upgrade failed: %v", err)
			return
		}

		// Create client
		clientID := fmt.Sprintf("test-client-%d", time.Now().UnixNano())
		client := ws.NewClient(clientID, conn, hub, testServer.logger)

		// Register and start pumps
		hub.Register(client)
		go client.WritePump()
		go client.ReadPump()
	})

	// Create test HTTP server
	testServer.Server = httptest.NewServer(handler)
	testServer.URL = testServer.Server.URL

	return testServer, nil
}

// GetRoom retrieves a room by ID
func (s *TestServer) GetRoom(roomID string) *ws.Room {
	return s.Hub.GetRoom(roomID)
}

// WaitForClients waits for the specified number of clients to connect
func (s *TestServer) WaitForClients(count int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for {
		stats := s.Hub.GetStats()
		totalClients := stats["total_clients"].(int)

		if totalClients >= count {
			return nil
		}

		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for %d clients, got %d", count, totalClients)
		}

		time.Sleep(50 * time.Millisecond)
	}
}

// WaitForRoomClients waits for the specified number of clients in a room
func (s *TestServer) WaitForRoomClients(roomID string, count int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for {
		room := s.GetRoom(roomID)
		if room != nil && room.ClientCount() >= count {
			return nil
		}

		if time.Now().After(deadline) {
			actualCount := 0
			if room != nil {
				actualCount = room.ClientCount()
			}
			return fmt.Errorf("timeout waiting for %d clients in room %s, got %d", count, roomID, actualCount)
		}

		time.Sleep(50 * time.Millisecond)
	}
}

// GetClientCount returns the total number of connected clients
func (s *TestServer) GetClientCount() int {
	stats := s.Hub.GetStats()
	return stats["total_clients"].(int)
}

// GetRoomCount returns the total number of rooms
func (s *TestServer) GetRoomCount() int {
	stats := s.Hub.GetStats()
	return stats["total_rooms"].(int)
}

// GetGameSession retrieves a game session by room ID
func (s *TestServer) GetGameSession(roomID string) (*game.Session, bool) {
	return s.GameMgr.GetSession(roomID)
}

// WaitForGameSession waits for a game session to be created
func (s *TestServer) WaitForGameSession(roomID string, timeout time.Duration) (*game.Session, error) {
	deadline := time.Now().Add(timeout)

	for {
		if session, ok := s.GameMgr.GetSession(roomID); ok {
			return session, nil
		}

		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timeout waiting for game session %s", roomID)
		}

		time.Sleep(50 * time.Millisecond)
	}
}

// Close shuts down the test server
func (s *TestServer) Close() {
	if s.Server != nil {
		s.Server.Close()
	}
}

// GetStats returns hub statistics
func (s *TestServer) GetStats() map[string]interface{} {
	return s.Hub.GetStats()
}

// Helper to create a test server with verbose logging (for debugging)
func CreateTestServerWithLogging(t *testing.T) (*TestServer, error) {
	t.Helper()

	// Create development logger for debugging
	logger, err := zap.NewDevelopment()
	if err != nil {
		return nil, fmt.Errorf("failed to create logger: %w", err)
	}

	return CreateTestServer(t, WithLogger(logger))
}
