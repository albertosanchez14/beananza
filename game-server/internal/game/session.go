package game

import (
	"context"
	"sync"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/storage"
)

// Session manages a game session for a specific room
type Session struct {
	// Game state
	state *State

	// Storage repository
	repo *storage.Repository

	// Logger
	logger *zap.Logger

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewSession creates a new game session
func NewSession(roomID string, repo *storage.Repository, logger *zap.Logger) *Session {
	return &Session{
		state:  NewState(roomID),
		repo:   repo,
		logger: logger.With(zap.String("room_id", roomID)),
	}
}

// GetState returns a clone of the current game state
func (s *Session) GetState() *State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state.Clone()
}

// HandlePlayerJoin handles a player joining the game
func (s *Session) HandlePlayerJoin(playerID, playerName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	player := s.state.AddPlayer(playerID, playerName)
	s.logger.Info("player joined game",
		zap.String("player_id", playerID),
		zap.String("player_name", playerName),
		zap.Int("player_count", s.state.PlayerCount()),
	)

	// Persist to Redis
	if s.repo != nil {
		ctx := context.Background()
		if err := s.repo.SaveGameState(ctx, s.state.RoomID, s.state); err != nil {
			s.logger.Error("failed to save game state", zap.Error(err))
			return err
		}
	}

	// Auto-start game if enough players (example: 2 players)
	if s.state.Phase == "waiting" && s.state.PlayerCount() >= 2 {
		s.startGame()
	}

	_ = player // Use player if needed for additional logic

	return nil
}

// HandlePlayerLeave handles a player leaving the game
func (s *Session) HandlePlayerLeave(playerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.state.RemovePlayer(playerID)
	s.logger.Info("player left game",
		zap.String("player_id", playerID),
		zap.Int("player_count", s.state.PlayerCount()),
	)

	// Persist to Redis
	if s.repo != nil {
		ctx := context.Background()
		if err := s.repo.SaveGameState(ctx, s.state.RoomID, s.state); err != nil {
			s.logger.Error("failed to save game state", zap.Error(err))
			return err
		}
	}

	// End game if not enough players
	if s.state.Phase == "playing" && s.state.PlayerCount() < 2 {
		s.endGame()
	}

	return nil
}

// HandleMove handles a player's move
func (s *Session) HandleMove(playerID string, action string, data map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state.Phase != "playing" {
		s.logger.Warn("move attempted while game not playing",
			zap.String("player_id", playerID),
			zap.String("phase", s.state.Phase),
		)
		return nil
	}

	s.logger.Debug("player move",
		zap.String("player_id", playerID),
		zap.String("action", action),
	)

	// Store move data in game state
	// This is game-specific logic - customize as needed
	moves, _ := s.state.GetData("moves")
	var movesList []map[string]interface{}
	if moves != nil {
		movesList = moves.([]map[string]interface{})
	}

	moveData := map[string]interface{}{
		"player_id": playerID,
		"action":    action,
		"data":      data,
	}
	movesList = append(movesList, moveData)
	s.state.SetData("moves", movesList)

	// Persist to Redis
	if s.repo != nil {
		ctx := context.Background()
		if err := s.repo.SaveGameState(ctx, s.state.RoomID, s.state); err != nil {
			s.logger.Error("failed to save game state", zap.Error(err))
			return err
		}
	}

	return nil
}

// startGame transitions the game to playing phase
func (s *Session) startGame() {
	s.state.SetPhase("playing")
	s.logger.Info("game started",
		zap.Int("player_count", s.state.PlayerCount()),
	)
}

// endGame transitions the game to finished phase
func (s *Session) endGame() {
	s.state.SetPhase("finished")
	s.logger.Info("game ended")
}

// LoadFromStorage loads game state from Redis
func (s *Session) LoadFromStorage(ctx context.Context) error {
	if s.repo == nil {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var state State
	if err := s.repo.GetGameState(ctx, s.state.RoomID, &state); err != nil {
		return err
	}

	s.state = &state
	s.logger.Info("game state loaded from storage",
		zap.Int("player_count", s.state.PlayerCount()),
		zap.String("phase", s.state.Phase),
	)

	return nil
}
