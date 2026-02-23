package game

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/storage"
)

// Session manages a game session for a specific room
type Session struct {
	state  *State
	repo   *storage.Repository
	logger *zap.Logger
	mu     sync.RWMutex
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

// GetFullSnapshot returns a complete snapshot of the session including all game data
func (s *Session) GetFullSnapshot() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snapshot := map[string]interface{}{
		"room_id":      s.state.RoomID,
		"phase":        s.state.Phase,
		"players":      s.state.Players,
		"turn_order":   s.state.TurnOrder,
		"current_turn": s.state.CurrentTurn,
		"center_cards": s.state.CenterCards,
		"started_at":   s.state.StartedAt,
		"ended_at":     s.state.EndedAt,
		"updated_at":   s.state.UpdatedAt,
		"data":         s.state.Data,
	}

	// Include deck size but not the actual deck contents (to prevent cheating)
	if s.state.CenterDeck != nil {
		snapshot["deck_size"] = s.state.CenterDeck.Size()
	} else {
		snapshot["deck_size"] = 0
	}

	return snapshot
}

// GetPlayerSnapshot returns a complete snapshot of the session for a player
// and what that player can see
func (s *Session) GetPlayerSnapshot(playerId string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	playerData, ok := s.state.GetPlayer(playerId)
	if !ok {
	}

	snapshot := map[string]interface{}{
		"room_id":      s.state.RoomID,
		"phase":        s.state.Phase,
		"player":       playerData,
		"turn_order":   s.state.TurnOrder,
		"current_turn": s.state.CurrentTurn,
		"center_cards": s.state.CenterCards,
		"started_at":   s.state.StartedAt,
		"ended_at":     s.state.EndedAt,
		"updated_at":   s.state.UpdatedAt,
		"data":         s.state.Data,
	}

	// Include deck size but not the actual deck contents
	if s.state.CenterDeck != nil {
		snapshot["deck_size"] = s.state.CenterDeck.Size()
	} else {
		snapshot["deck_size"] = 0
	}

	// Public data includes all player info except the actual hand cards (only hand size)
	externalPlayers := make([]map[string]interface{}, 0)
	for _, player := range s.state.Players {
		if player.ID == playerId {
			continue
		}
		externalPlayerData := map[string]interface{}{
			"playerId":       player.ID,
			"playerName":     player.Name,
			"playerStatus":   player.Status,
			"playerCoins":    player.Coins,
			"playerHandSize": len(player.Hand),
			"playerField":    player.Field,
		}
		externalPlayers = append(externalPlayers, externalPlayerData)
	}
	snapshot["external_players"] = externalPlayers

	return snapshot
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

// startGame transitions the game to playing phase
func (s *Session) startGame() {
	s.state.CenterDeck = NewDeck()
	s.state.CenterDeck.Shuffle()

	// Create random turn order from players
	s.state.TurnOrder = make([]string, 0, len(s.state.Players))
	for _, player := range s.state.Players {
		s.state.TurnOrder = append(s.state.TurnOrder, player.ID)
	}

	// Shuffle the turn order randomly
	s.shuffleTurnOrder()

	// Deal cards to players (5 cards each in standard Bohnanza)
	for playerID, player := range s.state.Players {
		player.Hand = s.state.CenterDeck.Draw(5)
		s.logger.Info("dealt cards to player",
			zap.String("player_id", playerID),
			zap.Int("cards_dealt", len(player.Hand)),
		)
	}

	s.state.SetPhase("plantHand")
	s.state.CurrentTurn = 0
	playerTurn := s.state.TurnOrder[s.state.CurrentTurn]

	s.logger.Info("game started",
		zap.Int("player_count", s.state.PlayerCount()),
		zap.Int("deck_size", s.state.CenterDeck.Size()),
		zap.Int("center_cards", len(s.state.CenterCards)),
		zap.String("player_turn_id", playerTurn),
	)
}

// shuffleTurnOrder randomizes the turn order
func (s *Session) shuffleTurnOrder() {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(s.state.TurnOrder), func(i, j int) {
		s.state.TurnOrder[i], s.state.TurnOrder[j] = s.state.TurnOrder[j], s.state.TurnOrder[i]
	})
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
		zap.String("phase", string(s.state.Phase)),
	)

	return nil
}

// HandlePlantBean handles planting a bean card on a field
func (s *Session) HandlePlantBean(playerID string, cardID string, slotId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.state.PlantBean(playerID, cardID, slotId); err != nil {
		return err
	}

	s.logger.Info("bean planted",
		zap.String("player_id", playerID),
		zap.String("card_id", cardID),
		// zap.String("card_type", string(cardToPlant.Name)),
		// zap.String("source", map[bool]string{true: "center", false: "hand"}[isFromCenter]),
		// zap.Int("beans_planted_turn", player.BeansPlantedTurn),
	)

	return s.persistState()
}

// HandleTurnOverBean handles turning over a bean from the center deck
func (s *Session) HandleTurnOverBean() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.state.TurnOverBean(); err != nil {
		return err
	}

	return s.persistState()
}

// HandleTradeBean handles trading a bean card between players
func (s *Session) HandleTradeBean(fromPlayerID string, toPlayerID string, cardsReceived []string, cardsGiven []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.state.TradeBeans(fromPlayerID, toPlayerID, cardsReceived, cardsGiven); err != nil {
		return err
	}

	s.logger.Info("bean traded",
		zap.String("from_player_id", fromPlayerID),
		zap.String("to_player_id", toPlayerID),
		// zap.String("card_id", cardID),
	)

	return s.persistState()
}

// HandleHarvestField handles harvesting a field
func (s *Session) HandleHarvestField(playerID, slotId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.state.HarvestField(playerID, slotId); err != nil {
		return err
	}

	s.logger.Info("field harvested",
		zap.String("player_id", playerID),
		// zap.String("card_type", string(slot.CardType)),
		// zap.Int("cards_harvested", slot.CardNumber),
		// zap.Int("coins_earned", coinsEarned),
	)

	return s.persistState()
}

func (s *Session) HandleNextPhase() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.state.NextPhase(); err != nil {
		return err
	}

	return s.persistState()
}

// persistState persists the current game state to Redis
func (s *Session) persistState() error {
	if s.repo != nil {
		ctx := context.Background()
		if err := s.repo.SaveGameState(ctx, s.state.RoomID, s.state); err != nil {
			s.logger.Error("failed to save game state", zap.Error(err))
			return err
		}
	}
	return nil
}
