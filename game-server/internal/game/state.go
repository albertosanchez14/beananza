package game

import (
	"slices"
	"time"

	"github.com/yourusername/game-server/internal/config"
)

type Player struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Status           string    `json:"status"` // "active", "idle", "disconnected"
	Coins            int       `json:"coins"`
	Hand             []*Card   `json:"hand"`
	Field            *Field    `json:"field"`
	PickedCards      []*Card   `json:"picked_cards"`
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
	Offers       []*Offer `json:"offers"`
	StartedAt    time.Time
	EndedAt      time.Time
	UpdatedAt    time.Time
	Cards        config.CardsConfig
	CardsPerTurn int
	// dirty is set to true by every mutation method and cleared by persistState
	// after a successful Redis write.  It prevents redundant serialisation when
	// multiple read-only operations happen between two real mutations.
	dirty bool `json:"-"`
}

// markDirty sets the dirty flag and bumps UpdatedAt on every state mutation.
// Call this at the end of every method that changes game state.
func (s *State) markDirty() {
	s.dirty = true
	s.UpdatedAt = time.Now()
}

// IsDirty reports whether the state has unsaved mutations.
func (s *State) IsDirty() bool {
	return s.dirty
}

// ClearDirty clears the dirty flag after the state has been persisted.
func (s *State) ClearDirty() {
	s.dirty = false
}

// NewState creates a new game state
func NewState(roomID string) *State {
	return &State{
		RoomID:      roomID,
		Phase:       "waiting",
		Players:     make(map[string]*Player),
		CenterCards: make([]*Card, 0),
		Offers:      make([]*Offer, 0),
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
		PickedCards:      make([]*Card, 0),
		BeansPlantedTurn: 0,
		JoinedAt:         time.Now(),
	}

	s.Players[playerId] = player
	s.markDirty()

	return player
}

// RemovePlayer removes a player from the game state
func (s *State) RemovePlayer(playerId string) {
	delete(s.Players, playerId)
	s.markDirty()
}

// GetPlayer retrieves a player by ID
func (s *State) GetPlayer(playerId string) (*Player, bool) {
	player, ok := s.Players[playerId]
	return player, ok
}

// SetPhase updates the game phase
func (s *State) SetPhase(phase PhaseType) {
	s.Phase = phase
	s.markDirty()

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
	s.markDirty()
	return nil
}

// UpdatePlayerScore updates a player's score
func (s *State) UpdatePlayerCoins(playerID string, score int) error {
	player, ok := s.Players[playerID]
	if !ok {
		return NewPlayerNotFoundError(playerID)
	}
	player.Coins = score
	s.markDirty()
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
		if player.Hand != nil {
			playerClone.Hand = make([]*Card, len(player.Hand))
			copy(playerClone.Hand, player.Hand)
		}
		if player.PickedCards != nil {
			playerClone.PickedCards = make([]*Card, len(player.PickedCards))
			copy(playerClone.PickedCards, player.PickedCards)
		}
		clone.Players[id] = &playerClone
	}

	// Clone turn order (shallow copy of pointers is fine since we cloned the players)
	copy(clone.TurnOrder, s.TurnOrder)

	// Clone offers (shallow copy of each offer struct is sufficient)
	clone.Offers = make([]*Offer, len(s.Offers))
	for i, o := range s.Offers {
		offerClone := *o
		clone.Offers[i] = &offerClone
	}

	return clone
}

func (s *State) PlantBean(playerId string, cardId string, slotId string) error {
	// During plantTrade, any player may plant their own picked cards —
	// the "whose turn is it" restriction only applies to plantHand/turnTrade.
	var player *Player
	if s.Phase == PhaseTypePlantTrade {
		p, ok := s.GetPlayer(playerId)
		if !ok {
			return NewPlayerNotFoundError(playerId)
		}
		player = p
	} else {
		p, err := s.isPlayerTurn(playerId)
		if err != nil {
			return err
		}
		player = p
	}

	if s.Phase != PhaseTypePlantHand && s.Phase != PhaseTypeTurnTrade && s.Phase != PhaseTypePlantTrade {
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
	isFromPickedCards := false

	// Find card in appropriate location based on phase
	switch s.Phase {
	case PhaseTypePlantHand:
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
		// RULE: In plantHand phase, cards must be planted in order (front of hand first)
		// TODO: Remove for loop and return generic error
		if cardIndex != 0 {
			return NewCardNotInOrderError(playerId, cardId)
		}
	case PhaseTypeTurnTrade:
		for i, card := range s.CenterCards {
			if card.ID == cardId {
				cardToPlant = card
				cardIndex = i
				isFromCenter = true
				break
			}
		}
		if cardToPlant == nil {
			for i, card := range player.PickedCards {
				if card.ID == cardId {
					cardToPlant = card
					cardIndex = i
					isFromPickedCards = true
					break
				}
			}
		}
		if cardToPlant == nil {
			return NewCardNotInCenterError(cardId)
		}
		// Planting from center or picked_cards — always advance to plantTrade first
		if err := s.nextPhase(playerId); err != nil {
			return err
		}
	case PhaseTypePlantTrade:
		for i, card := range s.CenterCards {
			if card.ID == cardId {
				// Only the turn player may plant center cards
				currentPlayerID := s.TurnOrder[s.CurrentTurn]
				if playerId != currentPlayerID {
					return NewNotPlayerTurnError(playerId, currentPlayerID)
				}
				cardToPlant = card
				cardIndex = i
				isFromCenter = true
				break
			}
		}
		if cardToPlant == nil {
			for i, card := range player.PickedCards {
				if card.ID == cardId {
					cardToPlant = card
					cardIndex = i
					isFromPickedCards = true
					break
				}
			}
		}
		if cardToPlant == nil {
			return NewInvalidActionError("card not found in picked cards or center")
		}
	}

	if err := player.Field.AddToSlot(slotId, cardToPlant.Name, cardId); err != nil {
		return err
	}

	if isFromCenter {
		s.CenterCards = append(s.CenterCards[:cardIndex], s.CenterCards[cardIndex+1:]...)
	} else if isFromPickedCards {
		player.PickedCards = append(player.PickedCards[:cardIndex], player.PickedCards[cardIndex+1:]...)
		// Auto-advance to drawCards when all players have planted their traded cards
		allPlanted := true
		for _, id := range s.TurnOrder {
			p, ok := s.GetPlayer(id)
			if !ok {
				continue
			}
			if len(p.PickedCards) > 0 {
				allPlanted = false
				break
			}
		}
		if allPlanted {
			s.nextPhase(playerId)
		}
	} else {
		player.Hand = append(player.Hand[:cardIndex], player.Hand[cardIndex+1:]...)
		player.BeansPlantedTurn++
	}

	// RULE: In plantHand phase, after planting 2 beans advance to the next phase.
	if s.Phase == PhaseTypePlantHand && player.BeansPlantedTurn >= 2 {
		if err := s.nextPhase(playerId); err != nil {
			return err
		}
	}

	s.markDirty()
	return nil
}

// turnOverBean performs the turn over bean logic without acquiring locks
func (s *State) TurnOverBean(playerId string) error {
	if _, err := s.isPlayerTurn(playerId); err != nil {
		return err
	}

	if s.Phase == PhaseTypePlantHand {
		if err := s.nextPhase(playerId); err != nil {
			return err
		}
		s.markDirty()
		return nil
	}

	if s.Phase != PhaseTypeTurnTrade {
		return NewInvalidPhaseError(s.Phase)
	}

	if s.DrawPile == nil || s.DrawPile.IsEmpty() {
		return NewDeckEmptyError()
	}

	if s.CardsTurned {
		return NewInvalidActionError("cards already drawn")
	}

	// RULE: Draw CardsPerTurn cards from deck and add to center
	cards := s.DrawPile.Draw(s.CardsPerTurn)
	s.CenterCards = cards
	s.CardsTurned = true

	s.markDirty()
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

	if ok := player.Field.CanHarvestSlot(slotId); !ok {
		return NewCannotHarvestSlotError(slotId)
	}

	slot, err := player.Field.GetSlotFromId(slotId)
	if err != nil {
		return err
	}

	// Calculate coins earned based on the number of cards
	coinsEarned := 0
	if slot.CardType != "" && slot.CardNumber > 0 {
		exchangeRates := GetExchangeRates(slot.CardType, s.Cards)
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

		discardedCards := CreateCards(slot.CardType, cardsToDiscard, slot.CardIds, s.Cards)
		s.DiscardPile.AddCards(discardedCards)
	}

	player.Coins += coinsEarned
	player.Field.RemoveFromSlot(slotId)

	s.markDirty()
	return nil
}

func (s *State) TradeBeans(fromPlayerID string, toPlayerID string, cardsReceived []string, cardsGiven []string) error {
	fromPlayer, ok := s.GetPlayer(fromPlayerID)
	if !ok {
		return NewPlayerNotFoundError(fromPlayerID)
	}

	toPlayer, ok := s.GetPlayer(toPlayerID)
	if !ok {
		return NewPlayerNotFoundError(toPlayerID)
	}

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
		fromPlayer.Hand = append(fromPlayer.Hand, cardsToReceive...)
	}

	return nil
}

// tradeToPickedCards performs the same card swap as TradeBeans but delivers
// the received cards into each player's PickedCards instead of their Hand.
// Used by AcceptOffer so traded cards must be planted during plantTrade phase.
func (s *State) tradeToPickedCards(fromPlayerID string, toPlayerID string, cardsReceived []string, cardsGiven []string) error {
	fromPlayer, ok := s.GetPlayer(fromPlayerID)
	if !ok {
		return NewPlayerNotFoundError(fromPlayerID)
	}

	toPlayer, ok := s.GetPlayer(toPlayerID)
	if !ok {
		return NewPlayerNotFoundError(toPlayerID)
	}

	// Collect cards the creator is giving away (from their Hand, or CenterCards)
	type cardSource struct {
		card        *Card
		handIndex   int // -1 if from center
		centerIndex int // -1 if from hand
	}
	cardsToGiveSources := make([]cardSource, 0, len(cardsGiven))
	for _, cardID := range cardsGiven {
		if cardID == "" {
			continue
		}
		found := false
		// Check hand first
		for i, card := range fromPlayer.Hand {
			if card.ID == cardID {
				cardsToGiveSources = append(cardsToGiveSources, cardSource{card, i, -1})
				found = true
				break
			}
		}
		if !found {
			// Fall back to center cards (turn player may offer center cards)
			for i, card := range s.CenterCards {
				if card.ID == cardID {
					cardsToGiveSources = append(cardsToGiveSources, cardSource{card, -1, i})
					found = true
					break
				}
			}
		}
		if !found {
			return NewCardNotInHandError(fromPlayerID, cardID)
		}
	}

	// Collect cards the acceptor is giving away (from their Hand, or CenterCards if acceptor is turn player)
	cardsToReceiveSources := make([]cardSource, 0, len(cardsReceived))
	for _, cardID := range cardsReceived {
		if cardID == "" {
			continue
		}
		found := false
		for i, card := range toPlayer.Hand {
			if card.ID == cardID {
				cardsToReceiveSources = append(cardsToReceiveSources, cardSource{card, i, -1})
				found = true
				break
			}
		}
		if !found && s.TurnOrder[s.CurrentTurn] == toPlayerID {
			for i, card := range s.CenterCards {
				if card.ID == cardID {
					cardsToReceiveSources = append(cardsToReceiveSources, cardSource{card, -1, i})
					found = true
					break
				}
			}
		}
		if !found {
			return NewCardNotInHandError(toPlayerID, cardID)
		}
	}

	// Remove given cards from creator's Hand or CenterCards → add to acceptor's PickedCards
	if len(cardsToGiveSources) > 0 {
		// Collect hand indices to remove
		handIndicesToRemove := make([]int, 0)
		centerIndicesToRemove := make([]int, 0)
		cardsToGive := make([]*Card, 0, len(cardsToGiveSources))
		for _, src := range cardsToGiveSources {
			cardsToGive = append(cardsToGive, src.card)
			if src.handIndex >= 0 {
				handIndicesToRemove = append(handIndicesToRemove, src.handIndex)
			} else {
				centerIndicesToRemove = append(centerIndicesToRemove, src.centerIndex)
			}
		}
		newHand := make([]*Card, 0, len(fromPlayer.Hand)-len(handIndicesToRemove))
		for i, card := range fromPlayer.Hand {
			if !slices.Contains(handIndicesToRemove, i) {
				newHand = append(newHand, card)
			}
		}
		fromPlayer.Hand = newHand
		newCenter := make([]*Card, 0, len(s.CenterCards)-len(centerIndicesToRemove))
		for i, card := range s.CenterCards {
			if !slices.Contains(centerIndicesToRemove, i) {
				newCenter = append(newCenter, card)
			}
		}
		s.CenterCards = newCenter
		toPlayer.PickedCards = append(toPlayer.PickedCards, cardsToGive...)
	}

	// Remove given cards from acceptor's Hand or CenterCards → add to creator's PickedCards
	if len(cardsToReceiveSources) > 0 {
		handIndicesToRemove := make([]int, 0)
		centerIndicesToRemove := make([]int, 0)
		cardsToReceive := make([]*Card, 0, len(cardsToReceiveSources))
		for _, src := range cardsToReceiveSources {
			cardsToReceive = append(cardsToReceive, src.card)
			if src.handIndex >= 0 {
				handIndicesToRemove = append(handIndicesToRemove, src.handIndex)
			} else {
				centerIndicesToRemove = append(centerIndicesToRemove, src.centerIndex)
			}
		}
		newHand := make([]*Card, 0, len(toPlayer.Hand)-len(handIndicesToRemove))
		for i, card := range toPlayer.Hand {
			if !slices.Contains(handIndicesToRemove, i) {
				newHand = append(newHand, card)
			}
		}
		toPlayer.Hand = newHand
		if len(centerIndicesToRemove) > 0 {
			newCenter := make([]*Card, 0, len(s.CenterCards)-len(centerIndicesToRemove))
			for i, card := range s.CenterCards {
				if !slices.Contains(centerIndicesToRemove, i) {
					newCenter = append(newCenter, card)
				}
			}
			s.CenterCards = newCenter
		}
		fromPlayer.PickedCards = append(fromPlayer.PickedCards, cardsToReceive...)
	}

	return nil
}

func (s *State) DrawCards(playerId string, cardsToDraw int) error {
	player, err := s.isPlayerTurn(playerId)
	if err != nil {
		return err
	}

	switch s.Phase {
	case PhaseTypeDrawCards, PhaseTypeTurnTrade, PhaseTypePlantTrade:
		// valid phases to draw from
	default:
		return NewInvalidPhaseError(s.Phase)
	}

	// RULE: When drawing cards from the DrawPile the turn ends.
	// endPhases advances from turnTrade/plantTrade to drawCards first.
	if err := s.endPhases(playerId); err != nil {
		return err
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

	s.markDirty()
	return s.nextPhase(playerId)
}

func (s *State) nextPhase(playerId string) error {
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
		s.Phase.NextPhase()
		if err := s.TurnOverBean(playerId); err != nil {
			return err
		}
		return nil
	case PhaseTypeTurnTrade:
		// RULE: turnTrade phase — center cards will be planted during plantTrade
		s.CardsTurned = false
		s.expireOffersForPhase()
	case PhaseTypePlantTrade:
		// RULE: All center cards must be planted before the phase can advance.
		if len(s.CenterCards) > 0 {
			return NewCenterCardsRemainingError(len(s.CenterCards))
		}
		// RULE: Every player who received traded cards must plant them all
		// before the phase can advance.
		for _, id := range s.TurnOrder {
			p, ok := s.GetPlayer(id)
			if !ok {
				continue
			}
			if len(p.PickedCards) > 0 {
				return NewInvalidActionError("all players must plant their picked cards before advancing")
			}
		}
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

func (s *State) endPhases(playerId string) error {
	switch s.Phase {
	case PhaseTypeTurnTrade:
		err := s.nextPhase(playerId)
		if err != nil {
			return err
		}
		err = s.nextPhase(playerId)
		if err != nil {
			return err
		}
	case PhaseTypePlantTrade:
		err := s.nextPhase(playerId)
		if err != nil {
			return err
		}
	}

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
	s.markDirty()
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

// -----------------------------------------------------------------------
// Offer methods
// -----------------------------------------------------------------------

// CreateOffer creates a new root offer during the turnTrade phase.
// cardsOffered must all be in the creator's hand.
// targetID may be empty to create an open offer.
func (s *State) CreateOffer(creatorID, targetID string, cardsOffered, cardsRequested []OfferCard) (*Offer, error) {
	if s.Phase != PhaseTypeTurnTrade {
		return nil, NewInvalidPhaseError(s.Phase)
	}

	creator, ok := s.GetPlayer(creatorID)
	if !ok {
		return nil, NewPlayerNotFoundError(creatorID)
	}

	if targetID != "" {
		if _, ok := s.GetPlayer(targetID); !ok {
			return nil, NewPlayerNotFoundError(targetID)
		}
		if creatorID == targetID {
			return nil, NewInvalidActionError("cannot create offer targeting yourself")
		}
	}

	turnPlayerID := s.TurnOrder[s.CurrentTurn]
	if creatorID != turnPlayerID {
		if targetID != turnPlayerID {
			return nil, NewInvalidActionError("non-turn players can only create offers targeting the current player")
		}
	}

	if err := s.validateCardsOffered(creator, cardsOffered, creatorID == s.TurnOrder[s.CurrentTurn]); err != nil {
		return nil, err
	}

	offer := &Offer{
		ID:             newOfferID(),
		CreatorID:      creatorID,
		TargetID:       targetID,
		ParentOfferID:  "",
		CardsOffered:   cardsOffered,
		CardsRequested: cardsRequested,
		Status:         OfferStatusPending,
		CreatedAt:      time.Now(),
	}

	s.Offers = append(s.Offers, offer)
	s.markDirty()

	return offer, nil
}

// CounterOffer creates a counteroffer against an existing pending offer.
// The counter-creator proposes their own cardsOffered/cardsRequested swap.
// Multiple players may counter the same parent offer simultaneously.
func (s *State) CounterOffer(parentOfferID, creatorID string, cardsOffered, cardsRequested []OfferCard) (*Offer, error) {
	if s.Phase != PhaseTypeTurnTrade {
		return nil, NewInvalidPhaseError(s.Phase)
	}

	creator, ok := s.GetPlayer(creatorID)
	if !ok {
		return nil, NewPlayerNotFoundError(creatorID)
	}

	parent := s.findOffer(parentOfferID)
	if parent == nil {
		return nil, NewOfferNotFoundError(parentOfferID)
	}

	if parent.Status != OfferStatusPending {
		return nil, NewInvalidActionError("parent offer is no longer pending")
	}

	if parent.CreatorID == creatorID {
		return nil, NewInvalidActionError("cannot counter your own offer")
	}

	if err := s.validateCardsOffered(creator, cardsOffered, creatorID == s.TurnOrder[s.CurrentTurn]); err != nil {
		return nil, err
	}

	offer := &Offer{
		ID:             newOfferID(),
		CreatorID:      creatorID,
		TargetID:       parent.CreatorID,
		ParentOfferID:  parentOfferID,
		CardsOffered:   cardsOffered,
		CardsRequested: cardsRequested,
		Status:         OfferStatusPending,
		CreatedAt:      time.Now(),
	}

	s.Offers = append(s.Offers, offer)
	s.markDirty()

	return offer, nil
}

// AcceptOffer accepts a pending offer, executing the card swap atomically.
// Acceptance rules:
//   - Root offer (ParentOfferID == ""): acceptorID must not be the creator, and if
//     TargetID is set it must match the acceptor.
//   - Counteroffer: only the parent offer's creator may accept.
//
// On success, the offer is marked accepted, sibling offers (same parent) are
// expired, and the card swap is executed via TradeBeans.
func (s *State) AcceptOffer(offerID, acceptorID string) error {
	if s.Phase != PhaseTypeTurnTrade {
		return NewInvalidPhaseError(s.Phase)
	}

	offer := s.findOffer(offerID)
	if offer == nil {
		return NewOfferNotFoundError(offerID)
	}

	if offer.Status != OfferStatusPending {
		return NewInvalidActionError("offer is no longer pending")
	}

	// Validate who is allowed to accept.
	if offer.ParentOfferID == "" {
		// Root offer
		if acceptorID == offer.CreatorID {
			return NewInvalidActionError("cannot accept your own offer")
		}
		if offer.TargetID != "" && acceptorID != offer.TargetID {
			return NewInvalidActionError("offer is targeted at a different player")
		}
	} else {
		// Counteroffer — only the parent offer's creator can accept.
		parent := s.findOffer(offer.ParentOfferID)
		if parent == nil {
			return NewOfferNotFoundError(offer.ParentOfferID)
		}
		if acceptorID != parent.CreatorID {
			return NewInvalidActionError("only the original offer creator can accept a counteroffer")
		}
	}

	// Execute the card swap:
	// offer.CardsOffered  → cards the creator gives → acceptor receives them.
	// offer.CardsRequested → cards the creator wants → acceptor gives them.

	// CardsOffered always carry explicit card IDs (creator's own cards).
	givenIDs := make([]string, 0, len(offer.CardsOffered))
	for _, c := range offer.CardsOffered {
		givenIDs = append(givenIDs, c.CardID)
	}

	// CardsRequested are specified by card_type only (card_id == ""), because
	// the creator cannot see the acceptor's hand. Resolve each request to a
	// concrete card ID from the acceptor's hand now, at acceptance time.
	acceptor, ok := s.GetPlayer(acceptorID)
	if !ok {
		return NewPlayerNotFoundError(acceptorID)
	}
	requestedIDs := make([]string, 0, len(offer.CardsRequested))
	// Track which acceptor hand indices have already been claimed so the same
	// card is not resolved twice when multiple cards of the same type are requested.
	claimed := make(map[int]bool)
	for _, c := range offer.CardsRequested {
		if c.CardID != "" {
			// Explicit ID (e.g. from a counteroffer where IDs are known).
			requestedIDs = append(requestedIDs, c.CardID)
			continue
		}
		// Resolve by card type.
		resolved := false
		for i, card := range acceptor.Hand {
			if !claimed[i] && card.Name == c.CardType {
				requestedIDs = append(requestedIDs, card.ID)
				claimed[i] = true
				resolved = true
				break
			}
		}
		if !resolved && acceptorID == s.TurnOrder[s.CurrentTurn] {
			for _, card := range s.CenterCards {
				if card.Name == c.CardType {
					requestedIDs = append(requestedIDs, card.ID)
					resolved = true
					break
				}
			}
		}
		if !resolved {
			return NewCardNotInHandError(acceptorID, string(c.CardType))
		}
	}

	// TradeBeans(fromPlayerID, toPlayerID, cardsReceived, cardsGiven)
	// fromPlayer = offer creator, toPlayer = acceptor
	// cardsReceived by fromPlayer = requestedIDs (from acceptor's hand)
	// cardsGiven by fromPlayer    = givenIDs     (from creator's hand)
	// Cards go to PickedCards (not Hand) so players must plant them in plantTrade.
	if err := s.tradeToPickedCards(offer.CreatorID, acceptorID, requestedIDs, givenIDs); err != nil {
		return err
	}

	offer.Status = OfferStatusAccepted

	// Expire all sibling pending offers (same parent, different ID).
	s.expireSiblings(offerID, offer.ParentOfferID)

	s.markDirty()
	return nil
}

// RejectOffer rejects a pending offer. The rejector must be the intended
// recipient: for a root offer the TargetID (if set) or any non-creator player;
// for a counteroffer the parent offer's creator.
func (s *State) RejectOffer(offerID, rejectorID string) error {
	if s.Phase != PhaseTypeTurnTrade {
		return NewInvalidPhaseError(s.Phase)
	}

	offer := s.findOffer(offerID)
	if offer == nil {
		return NewOfferNotFoundError(offerID)
	}

	if offer.Status != OfferStatusPending {
		return NewInvalidActionError("offer is no longer pending")
	}

	if offer.ParentOfferID == "" {
		if rejectorID == offer.CreatorID {
			return NewInvalidActionError("creator cannot reject their own offer, use cancel instead")
		}
		if offer.TargetID != "" && rejectorID != offer.TargetID {
			return NewInvalidActionError("offer is targeted at a different player")
		}
	} else {
		parent := s.findOffer(offer.ParentOfferID)
		if parent == nil {
			return NewOfferNotFoundError(offer.ParentOfferID)
		}
		if rejectorID != parent.CreatorID {
			return NewInvalidActionError("only the original offer creator can reject a counteroffer")
		}
	}

	offer.Status = OfferStatusRejected
	s.markDirty()
	return nil
}

// CancelOffer cancels a pending offer. Only the offer's creator may cancel it.
// Cancelling also expires all pending child counteroffers.
func (s *State) CancelOffer(offerID, cancellerID string) error {
	offer := s.findOffer(offerID)
	if offer == nil {
		return NewOfferNotFoundError(offerID)
	}

	if offer.Status != OfferStatusPending {
		return NewInvalidActionError("offer is no longer pending")
	}

	if offer.CreatorID != cancellerID {
		return NewInvalidActionError("only the offer creator can cancel this offer")
	}

	offer.Status = OfferStatusCancelled

	// Expire all pending children of this offer.
	s.expireChildren(offerID)

	s.markDirty()
	return nil
}

// expireOffersForPhase marks all pending offers as expired.
// Called when the phase transitions out of turnTrade.
func (s *State) expireOffersForPhase() {
	for _, o := range s.Offers {
		if o.Status == OfferStatusPending {
			o.Status = OfferStatusExpired
		}
	}
}

// findOffer returns the offer with the given ID, or nil.
func (s *State) findOffer(offerID string) *Offer {
	for _, o := range s.Offers {
		if o.ID == offerID {
			return o
		}
	}
	return nil
}

// expireSiblings expires all pending offers that share the same parent as offerID
// (excluding offerID itself).
func (s *State) expireSiblings(acceptedOfferID, parentOfferID string) {
	for _, o := range s.Offers {
		if o.ID != acceptedOfferID && o.ParentOfferID == parentOfferID && o.Status == OfferStatusPending {
			o.Status = OfferStatusExpired
		}
	}
}

// expireChildren recursively expires all pending offers whose ParentOfferID
// is the given offerID.
func (s *State) expireChildren(parentOfferID string) {
	for _, o := range s.Offers {
		if o.ParentOfferID == parentOfferID && o.Status == OfferStatusPending {
			o.Status = OfferStatusExpired
			s.expireChildren(o.ID)
		}
	}
}

// validateCardsOffered checks that every OfferCard in the list is present in
// the player's hand. When isTurnPlayer is true, cards found in CenterCards are
// also accepted (the active player may include turned-over center cards in an
// offer). Returns the first validation error encountered.
func (s *State) validateCardsOffered(player *Player, cards []OfferCard, isTurnPlayer bool) error {
	for _, oc := range cards {
		found := false
		for _, handCard := range player.Hand {
			if handCard.ID == oc.CardID {
				found = true
				break
			}
		}
		if !found && isTurnPlayer {
			for _, centerCard := range s.CenterCards {
				if centerCard.ID == oc.CardID {
					found = true
					break
				}
			}
		}
		if !found {
			return NewCardNotInHandError(player.ID, oc.CardID)
		}
	}
	return nil
}
