package game

import (
	"time"
)

type Player struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Status           string    `json:"status"` // "active", "idle", "disconnected"
	Coins            int       `json:"coins"`
	Hand             []*Card   `json:"hand"`
	Field            *Field    `json:"field"`
	BeansPlantedTurn int       `json:"beans_planted_turn"`
	JoinedAt         time.Time `json:"joined_at"`
}

type State struct {
	RoomID      string
	Phase       PhaseType
	Players     map[string]*Player
	CenterDeck  *Deck
	CenterCards []*Card
	TurnOrder   []string
	CurrentTurn int
	Data        map[string]interface{} // TODO: Remove?
	StartedAt   time.Time
	EndedAt     time.Time
	UpdatedAt   time.Time
}

// NewState creates a new game state
func NewState(roomID string) *State {
	return &State{
		RoomID:      roomID,
		Phase:       "waiting",
		Players:     make(map[string]*Player),
		CenterCards: make([]*Card, 0),
		CenterDeck:  nil,
		Data:        make(map[string]interface{}),
		UpdatedAt:   time.Now(),
	}
}

// AddPlayer adds a player to the game state
func (s *State) AddPlayer(playerID, playerName string) *Player {
	fieldID := "field-" + playerID
	// TODO: Change the number of fields depending on players
	field := NewField(fieldID, 2)

	player := &Player{
		ID:               playerID,
		Name:             playerName,
		Status:           "active",
		Coins:            0,
		Hand:             make([]*Card, 0),
		Field:            field,
		BeansPlantedTurn: 0,
		JoinedAt:         time.Now(),
	}

	s.Players[playerID] = player
	s.UpdatedAt = time.Now()

	return player
}

// RemovePlayer removes a player from the game state
func (s *State) RemovePlayer(playerID string) {
	delete(s.Players, playerID)
	s.UpdatedAt = time.Now()
}

// GetPlayer retrieves a player by ID
func (s *State) GetPlayer(playerID string) (*Player, bool) {
	player, ok := s.Players[playerID]
	return player, ok
}

// SetPhase updates the game phase
func (s *State) SetPhase(phase PhaseType) {
	s.Phase = phase
	s.UpdatedAt = time.Now()

	if phase == "playing" && s.StartedAt.IsZero() {
		s.StartedAt = time.Now()
	} else if phase == "finished" && s.EndedAt.IsZero() {
		s.EndedAt = time.Now()
	}
}

// GetPhase returns the current game phase
func (s *State) GetPhase() PhaseType {
	return s.Phase
}

// SetData sets a value in the game data
func (s *State) SetData(key string, value interface{}) {
	s.Data[key] = value
	s.UpdatedAt = time.Now()
}

// GetData retrieves a value from the game data
func (s *State) GetData(key string) (interface{}, bool) {
	value, ok := s.Data[key]
	return value, ok
}

// PlayerCount returns the number of players
func (s *State) PlayerCount() int {
	return len(s.Players)
}

// UpdatePlayerStatus updates a player's status
func (s *State) UpdatePlayerStatus(playerID, status string) {
	if player, ok := s.Players[playerID]; ok {
		player.Status = status
		s.UpdatedAt = time.Now()
	}
}

// UpdatePlayerScore updates a player's score
func (s *State) UpdatePlayerCoins(playerID string, score int) {
	if player, ok := s.Players[playerID]; ok {
		player.Coins = score
		s.UpdatedAt = time.Now()
	}
}

// Clone creates a deep copy of the state for safe reading
func (s *State) Clone() *State {
	clone := &State{
		RoomID:      s.RoomID,
		Phase:       s.Phase,
		Players:     make(map[string]*Player),
		TurnOrder:   make([]string, len(s.TurnOrder)),
		CurrentTurn: s.CurrentTurn,
		Data:        make(map[string]interface{}),
		StartedAt:   s.StartedAt,
		EndedAt:     s.EndedAt,
		UpdatedAt:   s.UpdatedAt,
	}

	for id, player := range s.Players {
		playerClone := *player
		clone.Players[id] = &playerClone
	}

	// Clone turn order (shallow copy of pointers is fine since we cloned the players)
	copy(clone.TurnOrder, s.TurnOrder)

	for key, value := range s.Data {
		clone.Data[key] = value
	}

	return clone
}

// TODO: return errors in logger and show them at the session.go handle-action
// TODO: only plant in order
func (s *State) PlantBean(playerID string, cardID string, slotId string) error {
	player, ok := s.GetPlayer(playerID)
	if !ok {
		//s.logger.Warn("player not found", zap.String("player_id", playerID))
		return nil
	}

	// Validate that it's the player's turn
	currentPlayerID := s.TurnOrder[s.CurrentTurn]
	if playerID != currentPlayerID {
		// s.logger.Warn("not player's turn",
		// 	zap.String("player_id", playerID),
		// 	zap.String("current_player_id", currentPlayerID),
		// )
		return nil
	}

	// Phase validation - allow planting in plantHand or turnTrade
	if s.Phase != PhaseTypePlantHand && s.Phase != PhaseTypeTurnTrade {
		// s.logger.Warn("action not valid in current phase",
		// 	zap.String("current_phase", string(s.state.Phase)),
		// )
		return nil
	}

	// RULE: In plantHand phase validate that
	// 1. Current player must plant at most 2 beans,
	// then it goes to the next phase
	if s.Phase == PhaseTypePlantHand && player.BeansPlantedTurn >= 2 {
		// s.logger.Warn("player has already planted max 2 beans this turn",
		// 	zap.String("player_id", playerID),
		// 	zap.Int("beans_planted", player.BeansPlantedTurn),
		// )
		return nil
	}

	var cardToPlant *Card
	cardIndex := -1
	isFromCenter := false

	// Try to find card in appropriate location based on phase
	if s.Phase == PhaseTypePlantHand {
		// In plantHand phase, only check player's hand
		for i, card := range player.Hand {
			if card.ID == cardID {
				cardToPlant = card
				cardIndex = i
				break
			}
		}
		if cardToPlant == nil {
			// s.logger.Warn("card not found in player's hand",
			// 	zap.String("player_id", playerID),
			// 	zap.String("card_id", cardID),
			// )
			return nil
		}
	} else if s.Phase == PhaseTypeTurnTrade {
		// In turnTrade phase, only check center cards
		for i, card := range s.CenterCards {
			if card.ID == cardID {
				cardToPlant = card
				cardIndex = i
				isFromCenter = true
				break
			}
		}
		if cardToPlant == nil {
			// s.logger.Warn("card not found in center",
			// 	zap.String("player_id", playerID),
			// 	zap.String("card_id", cardID),
			// )
			return nil
		}
	}

	// Plant the bean in the specified slot
	if err := player.Field.AddToSlot(slotId, cardToPlant.Name, 1); err != nil {
		// s.logger.Warn("failed to add card to slot",
		// 	zap.String("player_id", playerID),
		// 	zap.String("slot_id", slotId),
		// 	zap.Error(err),
		// )
		return err
	}

	if isFromCenter {
		// Remove from center
		s.CenterCards = append(s.CenterCards[:cardIndex], s.CenterCards[cardIndex+1:]...)
		// s.logger.Info("removed card from center",
		// 	zap.String("card_id", cardID),
		// 	zap.Int("remaining_center_cards", len(s.state.CenterCards)),
		// )
	} else {
		// Remove from hand
		player.Hand = append(player.Hand[:cardIndex], player.Hand[cardIndex+1:]...)
	}

	// Only increment beans planted counter in plantHand phase
	if s.Phase == PhaseTypePlantHand {
		player.BeansPlantedTurn++
	}

	// RULE: In plantHand phase validate that
	// 1. Current player must plant at most 2 beans,
	// then it goes to the next phase
	if player.BeansPlantedTurn >= 2 {
		s.NextPhase()
	}

	return nil
}

// turnOverBean performs the turn over bean logic without acquiring locks
func (s *State) TurnOverBean() error {
	if s.CenterDeck == nil || s.CenterDeck.IsEmpty() {
		// s.logger.Warn("deck is empty, cannot turn over bean")
		return nil
	}

	// Needs to be in phase - turnTrade
	if s.Phase != PhaseTypeTurnTrade {
		// s.logger.Error("action not valid in phase turnTrade")
		return nil
	}

	// Draw 2 cards from deck and add to center
	cards := s.CenterDeck.Draw(2)
	s.CenterCards = cards

	// s.logger.Info("beans turned over",
	// 	zap.String("card_id1", cards[0].ID),
	// 	zap.String("card_id2", cards[1].ID),
	// 	zap.String("card_type1", string(cards[0].Name)),
	// 	zap.String("card_type2", string(cards[1].Name)),
	// )

	return nil
}

func (s *State) HarvestField(playerId string, slotId string) error {
	player, ok := s.GetPlayer(playerId)
	if !ok {
		// s.logger.Warn("player not found", zap.String("player_id", playerID))
		return nil
	}

	if player.Field.IsEmpty() {
		// s.logger.Warn("field is empty, nothing to harvest",
		// 	zap.String("player_id", playerID),
		// )
		return nil
	}

	slot, err := player.Field.GetSlotFromId(slotId)
	if err != nil {
		return err
	}

	// Calculate coins earned based on the number of cards
	coinsEarned := 0
	if slot.CardType != "" && slot.CardNumber > 0 {
		exchangeRates := GetExchangeRates(slot.CardType)
		for numCards, coins := range exchangeRates {
			if slot.CardNumber >= numCards && coins > coinsEarned {
				coinsEarned = coins
			}
		}
	}

	player.Coins += coinsEarned
	player.Field.RemoveFromSlot(slotId)

	return nil
}

func (s *State) NextPhase() error {
	// RULE: In plantHand phase validate that
	// 1. Current player must plant at least 1 bean
	if s.Phase == PhaseTypePlantHand {
		currentPlayerID := s.TurnOrder[s.CurrentTurn]
		currentPlayer, ok := s.GetPlayer(currentPlayerID)
		if !ok {
			// s.logger.Error("current player not found",
			// 	zap.String("player_id", currentPlayerID),
			// )
			return nil
		}

		if currentPlayer.BeansPlantedTurn < 1 {
			// s.logger.Warn("cannot change phase, player must plant at least 1 bean",
			// 	zap.String("player_id", currentPlayerID),
			// 	zap.Int("beans_planted", currentPlayer.BeansPlantedTurn),
			// )
			return nil
		}

		// Reset beans planted counter when leaving plantHand phase
		currentPlayer.BeansPlantedTurn = 0
		// s.logger.Info("reset beans planted counter for player",
		// 	zap.String("player_id", currentPlayerID),
		// )
	}
	// RULE: turnTrade phase
	// 1. Beans in the middle should be planted or traded
	// TODO: 2. Beans traded should be planted
	if s.Phase == PhaseTypeTurnTrade {
		if len(s.CenterCards) != 0 {
			// s.logger.Warn("cannot change phase, there are still cards in the center",
			// 	zap.Int("center_cards_number", len(s.state.CenterCards)),
			// )
			return nil
		}
	}

	s.Phase.NextPhase()

	// s.logger.Info("next phase triggered",
	// 	zap.String("phase", string(s.state.GetPhase())))

	if s.GetPhase() == PhaseTypeTurnTrade {
		// Call internal method since we already hold the lock
		if err := s.TurnOverBean(); err != nil {
			// s.logger.Error("failed to turn over bean during phase change", zap.Error(err))
			// Continue with persist even if turnover fails
		}
	}

	return nil
}
