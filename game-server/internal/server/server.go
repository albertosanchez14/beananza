package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/objectstore"
	"github.com/yourusername/game-server/internal/storage"
	ws "github.com/yourusername/game-server/internal/websocket"
)

// Server represents the HTTP server
type Server struct {
	config      *config.Config
	hub         *ws.Hub
	repo        *storage.Repository
	logger      *zap.Logger
	server      *http.Server
	objectStore objectstore.ObjectStore
	upgrader    websocket.Upgrader
}

const avatarCleanupDeleteTimeout = 2 * time.Second

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
func New(cfg *config.Config, hub *ws.Hub, repo *storage.Repository, objectStore objectstore.ObjectStore, logger *zap.Logger) *Server {
	return &Server{
		config:      cfg,
		hub:         hub,
		repo:        repo,
		logger:      logger,
		objectStore: objectStore,
		upgrader:    newUpgrader(cfg),
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/ws", s.handleWebSocket)

	mux.HandleFunc("/register", s.handleRegister)

	mux.HandleFunc("/rooms", s.handleRooms)

	mux.HandleFunc("/config", s.handleConfig)

	mux.HandleFunc("/healthz", s.handleHealthz)

	if (s.config.Storage.Backend == "" || s.config.Storage.Backend == "local") &&
		strings.HasPrefix(s.config.Storage.LocalPublicBaseURL, "/") {
		publicPath := strings.TrimRight(s.config.Storage.LocalPublicBaseURL, "/") + "/"
		mux.Handle(publicPath, http.StripPrefix(publicPath, http.FileServer(http.Dir(s.config.Storage.LocalObjectDir))))
	}
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

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("ok\n")); err != nil {
		s.logger.Error("failed to write health response", zap.Error(err))
	}
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

// handleUploadAvatar accepts a multipart image upload, saves it to object
// storage and returns the URL under which the client can retrieve it.
//
// POST /upload-avatar
//
//	Body: multipart/form-data with field "avatar" containing the image file
//	Response: { "url": "<public avatar URL>" }
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
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.objectStore == nil {
		http.Error(w, "object storage is not configured", http.StatusServiceUnavailable)
		return
	}
	if s.repo == nil {
		http.Error(w, "avatar upload requires player storage", http.StatusServiceUnavailable)
		return
	}

	authToken := bearerToken(r)
	if authToken == "" {
		http.Error(w, "missing auth token", http.StatusUnauthorized)
		return
	}

	authCtx, authCancel := context.WithTimeout(r.Context(), 3*time.Second)
	profile, err := s.repo.GetPlayerByToken(authCtx, authToken)
	authCancel()
	if err != nil {
		s.logger.Error("failed to authenticate avatar upload", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if profile == nil {
		http.Error(w, "invalid or expired auth token", http.StatusUnauthorized)
		return
	}

	maxUploadBytes := s.config.Storage.MaxAvatarUploadBytes
	if maxUploadBytes <= 0 {
		maxUploadBytes = 2 << 20
	}
	tooLargeMessage := fmt.Sprintf("file too large (max %d bytes)", maxUploadBytes)

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, tooLargeMessage, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "missing avatar field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil {
		s.logger.Error("failed to read avatar upload", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if int64(len(data)) > maxUploadBytes {
		http.Error(w, tooLargeMessage, http.StatusBadRequest)
		return
	}

	contentType := http.DetectContentType(data)
	ext, ok := avatarExtension(contentType)
	if !ok {
		http.Error(w, "file must be an image", http.StatusBadRequest)
		return
	}

	objectKey := assetObjectKey(s.config.Storage.AvatarUploadPrefix, uuid.NewString()+ext)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	avatarURL, err := s.objectStore.Put(ctx, objectKey, bytes.NewReader(data), contentType)
	if err != nil {
		s.logger.Error("failed to store avatar", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	oldObjectKey, err := s.repo.UpdatePlayerAvatar(ctx, authToken, avatarURL, objectKey)
	if err != nil {
		if deleteErr := deleteObjectWithTimeout(s.objectStore, objectKey, avatarCleanupDeleteTimeout); deleteErr != nil {
			s.logger.Warn("failed to delete newly uploaded avatar after profile update failure",
				zap.String("object_key", objectKey),
				zap.Error(deleteErr),
			)
		}
		if errors.Is(err, storage.ErrPlayerAuthNotFound) {
			http.Error(w, "invalid or expired auth token", http.StatusUnauthorized)
			return
		}
		s.logger.Error("failed to update player avatar profile", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if oldObjectKey != "" && oldObjectKey != objectKey {
		if err := deleteObjectWithTimeout(s.objectStore, oldObjectKey, avatarCleanupDeleteTimeout); err != nil {
			s.logger.Warn("failed to delete replaced avatar object",
				zap.String("object_key", oldObjectKey),
				zap.Error(err),
			)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(map[string]string{
		"url": avatarURL,
	}); err != nil {
		s.logger.Error("failed to encode upload response", zap.Error(err))
	}
}

func deleteObjectWithTimeout(store objectstore.ObjectStore, key string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return store.Delete(ctx, key)
}

func bearerToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func assetObjectKey(prefix, filename string) string {
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		return filename
	}
	return prefix + "/" + filename
}

func avatarExtension(contentType string) (string, bool) {
	switch contentType {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	default:
		return "", false
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
		MaxPlayers   int                     `json:"max_players"`
		MinPlayers   int                     `json:"min_players"`
		CardsPerTurn int                     `json:"cards_per_turn"`
		Cards        []config.CardTypeConfig `json:"card_types"`
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
