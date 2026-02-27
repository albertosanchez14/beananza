package game

import (
	"slices"
	"time"
)

const (
	MAX_NUMBER_PLAYERS = 3
	MIN_NUMBER_PLAYERS = 2
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
	DrawPile    *Deck
	DiscardPile *Deck
	CenterCards []*Card
	TurnOrder   []string
	CurrentTurn int
	// Internal state
	CardsTurned  bool
	CardsDrawned bool
	// ==============
	StartedAt time.Time
	EndedAt   time.Time
	UpdatedAt time.Time
}

// NewState creates a new game state
func NewState(roomID string) *State {
	return &State{
		RoomID:      roomID,
		Phase:       "waiting",
		Players:     make(map[string]*Player),
		CenterCards: make([]*Card, 0),
		DrawPile:    nil,
		DiscardPile: nil,
		UpdatedAt:   time.Now(),
	}
}

// AddPlayer adds a player to the game state
func (s *State) AddPlayer(playerId, playerName string) *Player {
	fieldID := "field-" + playerId
	// TODO: Change the number of fields depending on players
	field := NewField(fieldID, 2)

	player := &Player{
		ID:               playerId,
		Name:             playerName,
		Status:           "active",
		Coins:            0,
		Hand:             make([]*Card, 0),
		Field:            field,
		BeansPlantedTurn: 0,
		JoinedAt:         time.Now(),
	}

	s.Players[playerId] = player
	s.UpdatedAt = time.Now()

	return player
}

// RemovePlayer removes a player from the game state
func (s *State) RemovePlayer(playerId string) {
	delete(s.Players, playerId)
	s.UpdatedAt = time.Now()
}

// GetPlayer retrieves a player by ID
func (s *State) GetPlayer(playerId string) (*Player, bool) {
	player, ok := s.Players[playerId]
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

// PlayerCount returns the number of players
func (s *State) PlayerCount() int {
	return len(s.Players)
}

// UpdatePlayerStatus updates a player's status
func (s *State) UpdatePlayerStatus(playerID, status string) error {
	player, ok := s.Players[playerID]
	if !ok {
		return NewPlayerNotFoundError(playerID)
	}
	player.Status = status
	s.UpdatedAt = time.Now()
	return nil
}

// UpdatePlayerScore updates a player's score
func (s *State) UpdatePlayerCoins(playerID string, score int) error {
	player, ok := s.Players[playerID]
	if !ok {
		return NewPlayerNotFoundError(playerID)
	}
	player.Coins = score
	s.UpdatedAt = time.Now()
	return nil
}

// Clone creates a deep copy of the state for safe reading
func (s *State) Clone() *State {
	clone := &State{
		RoomID:      s.RoomID,
		Phase:       s.Phase,
		Players:     make(map[string]*Player),
		TurnOrder:   make([]string, len(s.TurnOrder)),
		CurrentTurn: s.CurrentTurn,
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

	return clone
}

// TODO: return errors in logger and show them at the session.go handle-action
// TODO: only plant in order
func (s *State) PlantBean(playerId string, cardId string, slotId string) error {
	player, err := s.isPlayerTurn(playerId)
	if err != nil {
		return err
	}

	if s.Phase != PhaseTypePlantHand && s.Phase != PhaseTypeTurnTrade {
		return NewInvalidPhaseError(s.Phase)
	}

	// RULE: In plantHand phase validate that
	// 1. Current player must plant at most 2 beans,
	// then it goes to the next phase
	if s.Phase == PhaseTypePlantHand && player.BeansPlantedTurn >= 2 {
		return NewMaxBeansPlantedError(playerId, player.BeansPlantedTurn)
	}

	var cardToPlant *Card
	cardIndex := -1
	isFromCenter := false

	// Try to find card in appropriate location based on phase
	if s.Phase == PhaseTypePlantHand {
		for i, card := range player.Hand {
			if card.ID == cardId {
				cardToPlant = card
				cardIndex = i
				break
			}
		}
		if cardToPlant == nil {
			return NewCardNotInHandError(playerId, cardId)
		}
	} else if s.Phase == PhaseTypeTurnTrade {
		for i, card := range s.CenterCards {
			if card.ID == cardId {
				cardToPlant = card
				cardIndex = i
				isFromCenter = true
				break
			}
		}
		if cardToPlant == nil {
			return NewCardNotInCenterError(cardId)
		}
	}

	if err := player.Field.AddToSlot(slotId, cardToPlant.Name, cardId); err != nil {
		return err
	}

	if isFromCenter {
		s.CenterCards = append(s.CenterCards[:cardIndex], s.CenterCards[cardIndex+1:]...)
	} else {
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
		s.NextPhase(playerId)
	}

	return nil
}

// turnOverBean performs the turn over bean logic without acquiring locks
func (s *State) TurnOverBean(playerId string) error {
	_, err := s.isPlayerTurn(playerId)
	if err != nil {
		return err
	}

	if s.DrawPile == nil || s.DrawPile.IsEmpty() {
		return NewDeckEmptyError()
	}

	if s.CardsTurned {
		return NewInvalidActionError("cards already drawn")
	}

	if s.Phase == PhaseTypePlantHand {
		s.NextPhase(playerId)
	} else if s.Phase != PhaseTypeTurnTrade {
		return NewInvalidPhaseError(s.Phase)
	}

	// RULE: Can only draw 2 cards from deck and add to center
	cards := s.DrawPile.Draw(2)
	s.CenterCards = cards
	s.CardsTurned = true

	return nil
}

func (s *State) HarvestField(playerId string, slotId string) error {
	player, ok := s.GetPlayer(playerId)
	if !ok {
		return NewPlayerNotFoundError(playerId)
	}

	if player.Field.IsEmpty() {
		return NewFieldEmptyError(playerId)
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

	// Add the corresponding cards to the DiscardPile
	// Those are the ones that are not coins (cardsHarvested - coinsEarned)
	cardsToDiscard := slot.CardNumber - coinsEarned
	if cardsToDiscard > 0 && slot.CardType != "" {
		if s.DiscardPile == nil {
			s.DiscardPile = &Deck{Cards: make([]*Card, 0)}
		}

		discardedCards := CreateCards(slot.CardType, cardsToDiscard, slot.CardIds)
		s.DiscardPile.AddCards(discardedCards)
	}

	player.Coins += coinsEarned
	player.Field.RemoveFromSlot(slotId)

	return nil
}

// TODO: Review this method
func (s *State) TradeBeans(fromPlayerID string, toPlayerID string, cardsReceived []string, cardsGiven []string) error {
	fromPlayer, ok := s.GetPlayer(fromPlayerID)
	if !ok {
		return NewPlayerNotFoundError(fromPlayerID)
	}

	toPlayer, ok := s.GetPlayer(toPlayerID)
	if !ok {
		return NewPlayerNotFoundError(toPlayerID)
	}

	// Find and collect cards that fromPlayer is giving away
	cardsToGive := make([]*Card, 0, len(cardsGiven))
	cardsToGiveIndices := make([]int, 0, len(cardsGiven))

	for _, cardID := range cardsGiven {
		if cardID == "" {
			continue
		}
		found := false
		for i, card := range fromPlayer.Hand {
			if card.ID == cardID {
				cardsToGive = append(cardsToGive, card)
				cardsToGiveIndices = append(cardsToGiveIndices, i)
				found = true
				break
			}
		}
		if !found {
			return NewCardNotInHandError(fromPlayerID, cardID)
		}
	}

	// Find and collect cards that fromPlayer is receiving
	cardsToReceive := make([]*Card, 0, len(cardsReceived))
	cardsToReceiveIndices := make([]int, 0, len(cardsReceived))

	for _, cardID := range cardsReceived {
		if cardID == "" {
			continue
		}
		found := false
		for i, card := range toPlayer.Hand {
			if card.ID == cardID {
				cardsToReceive = append(cardsToReceive, card)
				cardsToReceiveIndices = append(cardsToReceiveIndices, i)
				found = true
				break
			}
		}
		if !found {
			return NewCardNotInHandError(toPlayerID, cardID)
		}
	}

	// Transfer cards from fromPlayer to toPlayer
	// Build new hand for fromPlayer excluding cards being given away
	if len(cardsToGive) > 0 {
		newFromPlayerHand := make([]*Card, 0, len(fromPlayer.Hand)-len(cardsToGive))
		for i, card := range fromPlayer.Hand {
			shouldRemove := slices.Contains(cardsToGiveIndices, i)
			if !shouldRemove {
				newFromPlayerHand = append(newFromPlayerHand, card)
			}
		}
		fromPlayer.Hand = newFromPlayerHand

		// Add cards to toPlayer's hand
		toPlayer.Hand = append(toPlayer.Hand, cardsToGive...)
	}

	// Transfer cards from toPlayer to fromPlayer
	// Build new hand for toPlayer excluding cards being given away
	if len(cardsToReceive) > 0 {
		newToPlayerHand := make([]*Card, 0, len(toPlayer.Hand)-len(cardsToReceive))
		for i, card := range toPlayer.Hand {
			shouldRemove := slices.Contains(cardsToReceiveIndices, i)
			if !shouldRemove {
				newToPlayerHand = append(newToPlayerHand, card)
			}
		}
		toPlayer.Hand = newToPlayerHand

		// Add cards to fromPlayer's hand
		fromPlayer.Hand = append(fromPlayer.Hand, cardsToReceive...)
	}

	return nil
}

func (s *State) DrawCards(playerId string, cardsToDraw int) error {
	player, ok := s.GetPlayer(playerId)
	if !ok {
		return NewPlayerNotFoundError(playerId)
	}

	drawnCards := s.DrawPile.Draw(cardsToDraw)

	if len(drawnCards) < cardsToDraw {
		s.ReShuffle()
		remainingNeeded := cardsToDraw - len(drawnCards)
		additionalCards := s.DrawPile.Draw(remainingNeeded)
		drawnCards = append(drawnCards, additionalCards...)
	}

	player.Hand = append(player.Hand, drawnCards...)
	s.CardsDrawned = true

	// RULE: When drawing cards from the DrawPile
	// the turn ends
	s.NextPhase(playerId)

	return nil
}

func (s *State) NextPhase(playerId string) error {
	switch s.Phase {
	case PhaseTypePlantHand:
		// RULE: In plantHand phase validate that
		// 1. Current player must plant at least 1 bean
		currentPlayerID := s.TurnOrder[s.CurrentTurn]
		currentPlayer, ok := s.GetPlayer(currentPlayerID)
		if !ok {
			return NewPlayerNotFoundError(currentPlayerID)
		}
		if currentPlayer.BeansPlantedTurn < 1 {
			return NewMinBeansRequiredError(currentPlayerID, currentPlayer.BeansPlantedTurn)
		}
		currentPlayer.BeansPlantedTurn = 0
	case PhaseTypeTurnTrade:
		// RULE: turnTrade phase
		// 1. Beans in the middle should be planted or traded
		// TODO: 2. Beans traded should be planted
		if len(s.CenterCards) != 0 {
			return NewCenterCardsRemainingError(len(s.CenterCards))
		}
		s.CardsTurned = false
	case PhaseTypeDrawCards:
		if !s.CardsDrawned {
			return NewNotDrawnedCardsError()
		}
		// RULE: When drawing cards from the DrawPile
		// the turn ends
		s.CardsDrawned = false
		s.nextTurn()
		return nil
	}

	s.Phase.NextPhase()

	return nil
}

func (s *State) ReShuffle() error {
	if !s.DrawPile.IsEmpty() || s.DiscardPile.IsEmpty() {
		return nil
	}

	s.DiscardPile.Shuffle()
	s.DrawPile.AddCards(s.DiscardPile.Cards)
	s.DiscardPile = &Deck{Cards: make([]*Card, 0)}

	return nil
}

func (s *State) nextTurn() error {
	if s.CurrentTurn == len(s.TurnOrder)-1 {
		s.CurrentTurn = 0
	} else {
		s.CurrentTurn += 1
	}
	s.Phase.ResetPhase()
	return nil
}

func (s *State) isPlayerTurn(playerId string) (*Player, error) {
	player, ok := s.GetPlayer(playerId)
	if !ok {
		return nil, NewPlayerNotFoundError(playerId)
	}

	currentPlayerID := s.TurnOrder[s.CurrentTurn]
	if playerId != currentPlayerID {
		return nil, NewNotPlayerTurnError(playerId, currentPlayerID)
	}

	return player, nil
}
