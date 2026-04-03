package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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

	mux.HandleFunc("/register", s.handleRegister)

	mux.HandleFunc("/rooms", s.handleRooms)

	mux.HandleFunc("/config", s.handleConfig)

	os.MkdirAll("./uploads/avatars", 0755)
	mux.Handle("/user-avatars/", http.StripPrefix("/user-avatars/", http.FileServer(http.Dir("./uploads/avatars"))))
	mux.HandleFunc("/upload-avatar", s.handleUploadAvatar)

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

// handleRegister creates a new player profile, generates a server-side
// player_id and a long-lived auth_token, persists them in Redis, and returns
// them to the client so they can be stored in localStorage.
//
// POST /register
//
//	Body: { "name": "<display name, max 24 chars>" }
//	Response: { "player_id": "...", "auth_token": "..." }
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
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
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.repo == nil {
		http.Error(w, "registration not available without storage", http.StatusServiceUnavailable)
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if len(name) > 24 {
		http.Error(w, "name must be 24 characters or fewer", http.StatusBadRequest)
		return
	}

	playerID := uuid.NewString()
	authToken := uuid.NewString()

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	profile := storage.PlayerProfile{
		PlayerID:   playerID,
		PlayerName: name,
	}
	if err := s.repo.SavePlayerAuth(ctx, authToken, profile); err != nil {
		s.logger.Error("failed to save player auth", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	s.logger.Info("player registered",
		zap.String("player_id", playerID),
		zap.String("player_name", name),
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(map[string]string{
		"player_id":  playerID,
		"auth_token": authToken,
	}); err != nil {
		s.logger.Error("failed to encode register response", zap.Error(err))
	}
}

// handleUploadAvatar accepts a multipart image upload, saves it to disk and
// returns the URL path under which the client can retrieve it.
//
// POST /upload-avatar
//
//	Body: multipart/form-data with field "avatar" containing the image file
//	Response: { "url": "/avatars/<filename>" }
func (s *Server) handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
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
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(2 << 20); err != nil {
		http.Error(w, "file too large (max 2 MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "missing avatar field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "file must be an image", http.StatusBadRequest)
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".webp"
	}

	filename := uuid.NewString() + ext
	dst, err := os.Create(filepath.Join("./uploads/avatars", filename))
	if err != nil {
		s.logger.Error("failed to create avatar file", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		s.logger.Error("failed to write avatar file", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(map[string]string{
		"url": "/user-avatars/" + filename,
	}); err != nil {
		s.logger.Error("failed to encode upload response", zap.Error(err))
	}
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

// handleConfig returns the game configuration (card types, exchange rates, and
// game settings) as JSON. This endpoint is safe to call before joining a room
// and does not include any per-session state.
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
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

	type configResponse struct {
		MaxPlayers   int                      `json:"max_players"`
		MinPlayers   int                      `json:"min_players"`
		CardsPerTurn int                      `json:"cards_per_turn"`
		Cards        []config.CardTypeConfig  `json:"card_types"`
	}

	resp := configResponse{
		MaxPlayers:   s.config.Game.MaxNumberPlayers,
		MinPlayers:   s.config.Game.MinNumberPlayers,
		CardsPerTurn: s.config.Game.CardsPerTurn,
		Cards:        s.config.Game.Cards.CardTypes,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		s.logger.Error("failed to encode config response", zap.Error(err))
	}
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
