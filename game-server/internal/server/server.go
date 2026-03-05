package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/storage"
	ws "github.com/yourusername/game-server/internal/websocket"
)

// Server represents the HTTP server
type Server struct {
	config   *config.Config
	hub      *ws.Hub
	repo     *storage.Repository
	logger   *zap.Logger
	server   *http.Server
	upgrader websocket.Upgrader
}

// newUpgrader returns a WebSocket upgrader that validates the request origin
// against the allowed origins configured via ALLOWED_ORIGINS.
func newUpgrader(cfg *config.Config) websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  cfg.WS.ReadBufferSize,
		WriteBufferSize: cfg.WS.WriteBufferSize,
		CheckOrigin: func(r *http.Request) bool {
			if len(cfg.Server.AllowedOrigins) == 0 {
				return true // no restriction configured (dev / test)
			}
			origin := r.Header.Get("Origin")
			for _, allowed := range cfg.Server.AllowedOrigins {
				if strings.EqualFold(origin, allowed) {
					return true
				}
			}
			return false
		},
	}
}

// New creates a new HTTP server
func New(cfg *config.Config, hub *ws.Hub, repo *storage.Repository, logger *zap.Logger) *Server {
	return &Server{
		config:   cfg,
		hub:      hub,
		repo:     repo,
		logger:   logger,
		upgrader: newUpgrader(cfg),
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/ws", s.handleWebSocket)

	mux.HandleFunc("/rooms", s.handleRooms)

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
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("websocket upgrade failed", zap.Error(err))
		return
	}

	// Create new client with a collision-safe UUID
	clientID := uuid.NewString()
	client := ws.NewClient(clientID, conn, s.hub, s.config, s.logger)

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

// handleRooms returns the list of active rooms as JSON.
func (s *Server) handleRooms(w http.ResponseWriter, r *http.Request) {
	// CORS: allow configured origins (or all when none are configured).
	origin := r.Header.Get("Origin")
	if len(s.config.Server.AllowedOrigins) == 0 {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else {
		for _, allowed := range s.config.Server.AllowedOrigins {
			if strings.EqualFold(origin, allowed) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rooms := s.hub.GetRoomList()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(rooms); err != nil {
		s.logger.Error("failed to encode rooms response", zap.Error(err))
	}
}
