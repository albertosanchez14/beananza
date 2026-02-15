package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/storage"
	ws "github.com/yourusername/game-server/internal/websocket"
)

// Server represents the HTTP server
type Server struct {
	config *config.Config
	hub    *ws.Hub
	repo   *storage.Repository
	logger *zap.Logger
	server *http.Server
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// TODO: Configure this properly for production
		return true
	},
}

// New creates a new HTTP server
func New(cfg *config.Config, hub *ws.Hub, repo *storage.Repository, logger *zap.Logger) *Server {
	return &Server{
		config: cfg,
		hub:    hub,
		repo:   repo,
		logger: logger,
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// WebSocket endpoint
	mux.HandleFunc("/ws", s.handleWebSocket)

	addr := fmt.Sprintf("%s:%s", s.config.Server.Host, s.config.Server.Port)
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.loggingMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	s.logger.Info("starting server", zap.String("addr", addr))

	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server failed: %w", err)
	}

	return nil
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down server")
	return s.server.Shutdown(ctx)
}

// handleWebSocket handles WebSocket upgrade requests
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("websocket upgrade failed", zap.Error(err))
		return
	}

	// Create new client
	clientID := generateClientID()
	client := ws.NewClient(clientID, conn, s.hub, s.logger)

	// Register client with hub
	s.hub.Register(client)

	s.logger.Info("websocket connection established",
		zap.String("client_id", clientID),
		zap.String("remote_addr", r.RemoteAddr),
	)

	// Start client goroutines
	go client.WritePump()
	go client.ReadPump()
}

// loggingMiddleware logs incoming HTTP requests
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		next.ServeHTTP(w, r)

		s.logger.Debug("http request",
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("remote_addr", r.RemoteAddr),
			zap.Duration("duration", time.Since(start)),
		)
	})
}

// generateClientID generates a unique client ID
func generateClientID() string {
	return fmt.Sprintf("client_%d", time.Now().UnixNano())
}
