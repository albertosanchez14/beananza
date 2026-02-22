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

	// Include deck size but not the actual deck contents (to prevent cheating)
	if s.state.CenterDeck != nil {
		snapshot["deck_size"] = s.state.CenterDeck.Size()
	} else {
		snapshot["deck_size"] = 0
	}

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
func (s *Session) HandlePlantBean(playerID string, cardID string, fieldID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	player, ok := s.state.GetPlayer(playerID)
	if !ok {
		s.logger.Warn("player not found", zap.String("player_id", playerID))
		return nil
	}

	// Validate that it's the player's turn
	currentPlayerID := s.state.TurnOrder[s.state.CurrentTurn]
	if playerID != currentPlayerID {
		s.logger.Warn("not player's turn",
			zap.String("player_id", playerID),
			zap.String("current_player_id", currentPlayerID),
		)
		return nil
	}

	// Phase validation - allow planting in plantHand or turnTrade
	if s.state.Phase != PhaseTypePlantHand && s.state.Phase != PhaseTypeTurnTrade {
		s.logger.Warn("action not valid in current phase",
			zap.String("current_phase", string(s.state.Phase)),
		)
		return nil
	}

	// Card limit enforcement - only in plantHand phase
	if s.state.Phase == PhaseTypePlantHand {
		if player.BeansPlantedTurn >= 2 {
			s.logger.Warn("player has already planted max 2 beans this turn",
				zap.String("player_id", playerID),
				zap.Int("beans_planted", player.BeansPlantedTurn),
			)
			return nil
		}
	}

	var cardToPlant *Card
	cardIndex := -1
	isFromCenter := false

	// Try to find card in appropriate location based on phase
	if s.state.Phase == PhaseTypePlantHand {
		// In plantHand phase, only check player's hand
		for i, card := range player.Hand {
			if card.ID == cardID {
				cardToPlant = card
				cardIndex = i
				break
			}
		}
		if cardToPlant == nil {
			s.logger.Warn("card not found in player's hand",
				zap.String("player_id", playerID),
				zap.String("card_id", cardID),
			)
			return nil
		}
	} else if s.state.Phase == PhaseTypeTurnTrade {
		// In turnTrade phase, only check center cards
		for i, card := range s.state.CenterCards {
			if card.ID == cardID {
				cardToPlant = card
				cardIndex = i
				isFromCenter = true
				break
			}
		}
		if cardToPlant == nil {
			s.logger.Warn("card not found in center",
				zap.String("player_id", playerID),
				zap.String("card_id", cardID),
			)
			return nil
		}
	}

	// Only plant a bean if there are slots free or
	// a card of the same kind
	slotAdded := false
	for _, slot := range player.Field.Slots {
		if slot.CardType == cardToPlant.Name {
			slot.CardNumber++
			slotAdded = true
			break
		}
	}
	if !slotAdded {
		if player.Field.IsFull() {
			s.logger.Warn("field is full and card doesn't match existing slots",
				zap.String("player_id", playerID),
			)
			return nil
		}
		if !player.Field.AddSlot(cardToPlant.Name) {
			s.logger.Warn("failed to add slot to field",
				zap.String("player_id", playerID),
			)
			return nil
		}
	}

	if isFromCenter {
		// Remove from center
		s.state.CenterCards = append(s.state.CenterCards[:cardIndex], s.state.CenterCards[cardIndex+1:]...)
		s.logger.Info("removed card from center",
			zap.String("card_id", cardID),
			zap.Int("remaining_center_cards", len(s.state.CenterCards)),
		)
	} else {
		// Remove from hand
		player.Hand = append(player.Hand[:cardIndex], player.Hand[cardIndex+1:]...)
	}

	// Only increment beans planted counter in plantHand phase
	if s.state.Phase == PhaseTypePlantHand {
		player.BeansPlantedTurn++
	}
	//TODO: If reached 2 beans planted go to the next turn

	s.logger.Info("bean planted",
		zap.String("player_id", playerID),
		zap.String("card_id", cardID),
		zap.String("card_type", string(cardToPlant.Name)),
		zap.String("source", map[bool]string{true: "center", false: "hand"}[isFromCenter]),
		zap.Int("beans_planted_turn", player.BeansPlantedTurn),
	)

	return s.persistState()
}

// HandleTradeBean handles trading a bean card between players
func (s *Session) HandleTradeBean(fromPlayerID, toPlayerID, cardID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fromPlayer, ok := s.state.GetPlayer(fromPlayerID)
	if !ok {
		s.logger.Warn("from player not found", zap.String("player_id", fromPlayerID))
		return nil
	}

	toPlayer, ok := s.state.GetPlayer(toPlayerID)
	if !ok {
		s.logger.Warn("to player not found", zap.String("player_id", toPlayerID))
		return nil
	}

	// Find card in from player's hand
	var cardToTrade *Card
	cardIndex := -1
	for i, card := range fromPlayer.Hand {
		if card.ID == cardID {
			cardToTrade = card
			cardIndex = i
			break
		}
	}

	if cardToTrade == nil {
		s.logger.Warn("card not found in player's hand",
			zap.String("player_id", fromPlayerID),
			zap.String("card_id", cardID),
		)
		return nil
	}

	// Remove from source player's hand
	fromPlayer.Hand = append(fromPlayer.Hand[:cardIndex], fromPlayer.Hand[cardIndex+1:]...)

	// Add to target player's hand
	toPlayer.Hand = append(toPlayer.Hand, cardToTrade)

	s.logger.Info("bean traded",
		zap.String("from_player_id", fromPlayerID),
		zap.String("to_player_id", toPlayerID),
		zap.String("card_id", cardID),
	)

	return s.persistState()
}

// HandleHarvestField handles harvesting a field
func (s *Session) HandleHarvestField(playerID, fieldID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	player, ok := s.state.GetPlayer(playerID)
	if !ok {
		s.logger.Warn("player not found", zap.String("player_id", playerID))
		return nil
	}

	// Parse field slot index from fieldID (format: "field-{playerID}-slot-{index}")
	// For simplicity, harvest the first slot if field is not empty
	if player.Field.IsEmpty() {
		s.logger.Warn("field is empty, nothing to harvest",
			zap.String("player_id", playerID),
		)
		return nil
	}

	// Get the first slot
	slot := player.Field.Slots[0]

	// Calculate coins earned
	coinsEarned := 0
	// In a real implementation, you'd look up the card definition to get the exchange rate
	// For now, we'll use a simple calculation
	if slot.CardNumber >= 4 {
		coinsEarned = slot.CardNumber / 2
	}

	player.Coins += coinsEarned

	// Remove the slot
	player.Field.RemoveSlot(0)

	s.logger.Info("field harvested",
		zap.String("player_id", playerID),
		zap.String("card_type", string(slot.CardType)),
		zap.Int("cards_harvested", slot.CardNumber),
		zap.Int("coins_earned", coinsEarned),
	)

	return s.persistState()
}

// turnOverBean performs the turn over bean logic without acquiring locks
func (s *Session) turnOverBean() error {
	if s.state.CenterDeck == nil || s.state.CenterDeck.IsEmpty() {
		s.logger.Warn("deck is empty, cannot turn over bean")
		return nil
	}

	// Needs to be in phase - turnTrade
	if s.state.Phase != PhaseTypeTurnTrade {
		s.logger.Error("action not valid in phase turnTrade")
		return nil
	}

	// Draw 2 cards from deck and add to center
	cards := s.state.CenterDeck.Draw(2)
	s.state.CenterCards = cards

	s.logger.Info("beans turned over",
		zap.String("card_id1", cards[0].ID),
		zap.String("card_id2", cards[1].ID),
		zap.String("card_type1", string(cards[0].Name)),
		zap.String("card_type2", string(cards[1].Name)),
	)

	return nil
}

// HandleTurnOverBean handles turning over a bean from the center deck
func (s *Session) HandleTurnOverBean() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.turnOverBean(); err != nil {
		return err
	}

	return s.persistState()
}

func (s *Session) HandleNextPhase() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// RULE: In plantHand phase validate that
	// 1. Current player must plant at least 1 bean
	if s.state.Phase == PhaseTypePlantHand {
		currentPlayerID := s.state.TurnOrder[s.state.CurrentTurn]
		currentPlayer, ok := s.state.GetPlayer(currentPlayerID)
		if !ok {
			s.logger.Error("current player not found",
				zap.String("player_id", currentPlayerID),
			)
			return nil
		}

		if currentPlayer.BeansPlantedTurn < 1 {
			s.logger.Warn("cannot change phase, player must plant at least 1 bean",
				zap.String("player_id", currentPlayerID),
				zap.Int("beans_planted", currentPlayer.BeansPlantedTurn),
			)
			return nil
		}

		// Reset beans planted counter when leaving plantHand phase
		currentPlayer.BeansPlantedTurn = 0
		s.logger.Info("reset beans planted counter for player",
			zap.String("player_id", currentPlayerID),
		)
	}
	// RULE: turnTrade phase
	// 1. Beans in the middle should be planted or traded
	// TODO: 2. Beans traded should be planted
	if s.state.Phase == PhaseTypeTurnTrade {
		if len(s.state.CenterCards) != 0 {
			s.logger.Warn("cannot change phase, there are still cards in the center",
				zap.Int("center_cards_number", len(s.state.CenterCards)),
			)
			return nil
		}
	}

	s.state.NextPhase()

	s.logger.Info("next phase triggered",
		zap.String("phase", string(s.state.GetPhase())))

	if s.state.GetPhase() == PhaseTypeTurnTrade {
		// Call internal method since we already hold the lock
		if err := s.turnOverBean(); err != nil {
			s.logger.Error("failed to turn over bean during phase change", zap.Error(err))
			// Continue with persist even if turnover fails
		}
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
