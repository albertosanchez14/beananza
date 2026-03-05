package game

import (
	"context"
	"math/rand"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/storage"
)

type SessionState string

const (
	SessionStateWaiting SessionState = "waiting"
	SessionStatePlaying SessionState = "playing"
	SessionStatePause   SessionState = "pause"
)

type Session struct {
	config       *config.Config
	gameState    *State
	waitingLobby *WaitingLobby
	state        SessionState
	repo         *storage.Repository
	logger       *zap.Logger
	mu           sync.RWMutex
}

func NewSession(roomID string, cfg *config.Config, repo *storage.Repository, logger *zap.Logger) *Session {
	return &Session{
		config:       cfg,
		gameState:    NewState(roomID),
		waitingLobby: NewWaitingLobby(roomID, cfg.Game.MinNumberPlayers, cfg.Game.MaxNumberPlayers),
		state:        SessionStateWaiting,
		repo:         repo,
		logger:       logger.With(zap.String("room_id", roomID)),
	}
}

func (s *Session) GetState() *State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.gameState.Clone()
}

func (s *Session) IsPlaying() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state == SessionStatePlaying
}

// GetFullSnapshot returns a complete snapshot of the session including all game data
func (s *Session) GetFullSnapshot() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snapshot := map[string]any{
		"room_id":      s.gameState.RoomID,
		"phase":        s.gameState.Phase,
		"players":      s.gameState.Players,
		"turn_order":   s.gameState.TurnOrder,
		"current_turn": s.gameState.CurrentTurn,
		"center_cards": s.gameState.CenterCards,
		"offers":       s.gameState.Offers,
		"started_at":   s.gameState.StartedAt,
		"ended_at":     s.gameState.EndedAt,
		"updated_at":   s.gameState.UpdatedAt,
	}

	// Include deck size but not the actual deck contents (to prevent cheating)
	if s.gameState.DrawPile != nil {
		snapshot["deck_size"] = s.gameState.DrawPile.Size()
	} else {
		snapshot["deck_size"] = 0
	}

	// Include discard pile size
	if s.gameState.DiscardPile != nil {
		snapshot["discard_pile_size"] = s.gameState.DiscardPile.Size()
	} else {
		snapshot["discard_pile_size"] = 0
	}

	return snapshot
}

// GetPlayerSnapshot returns a complete snapshot of the session for a player
// and what that player can see
func (s *Session) GetPlayerSnapshot(playerId string) map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	playerData, ok := s.gameState.GetPlayer(playerId)
	if !ok {
	}

	snapshot := map[string]any{
		"room_id":      s.gameState.RoomID,
		"phase":        s.gameState.Phase,
		"player":       playerData,
		"turn_order":   s.gameState.TurnOrder,
		"current_turn": s.gameState.CurrentTurn,
		"center_cards": s.gameState.CenterCards,
		"offers":       s.gameState.Offers,
		"started_at":   s.gameState.StartedAt,
		"ended_at":     s.gameState.EndedAt,
		"updated_at":   s.gameState.UpdatedAt,
	}

	// Include deck size but not the actual deck contents
	if s.gameState.DrawPile != nil {
		snapshot["deck_size"] = s.gameState.DrawPile.Size()
	} else {
		snapshot["deck_size"] = 0
	}

	// Include discard pile size
	if s.gameState.DiscardPile != nil {
		snapshot["discard_pile_size"] = s.gameState.DiscardPile.Size()
	} else {
		snapshot["discard_pile_size"] = 0
	}

	// Public data includes all player info except the actual hand cards (only hand size).
	// Players are ordered according to TurnOrder to ensure a consistent order across snapshots.
	capacity := max(len(s.gameState.Players)-1, 0)
	externalPlayers := make([]map[string]any, 0, capacity)
	for _, id := range s.gameState.TurnOrder {
		if id == playerId {
			continue
		}
		player, ok := s.gameState.Players[id]
		if !ok {
			continue
		}
		externalPlayerData := map[string]any{
			"playerId":               player.ID,
			"playerName":             player.Name,
			"playerStatus":           player.Status,
			"playerCoins":            player.Coins,
			"playerHandSize":         len(player.Hand),
			"playerPickedCardsCount": len(player.PickedCards),
			"playerField":            player.Field,
		}
		externalPlayers = append(externalPlayers, externalPlayerData)
	}
	snapshot["external_players"] = externalPlayers

	return snapshot
}

func (s *Session) GetWaitingLobbySnapshot() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	canStart, _ := s.waitingLobby.CanStartGame()

	snapshot := map[string]any{
		"players":     s.waitingLobby.Players,
		"max_players": s.waitingLobby.MaxPlayers,
		"min_players": s.waitingLobby.MinPlayers,
		"can_start":   canStart,
		"updated_at":  s.waitingLobby.UpdatedAt,
	}

	return snapshot
}

// logAndReturnError logs errors with appropriate level and context, then returns the error
func (s *Session) logAndReturnError(action string, err error) error {
	if err == nil {
		return nil
	}

	// Check if it's a GameError (expected game rule violations)
	if gameErr, ok := err.(*GameError); ok {
		s.logger.Warn("game action failed",
			zap.String("action", action),
			zap.String("error_code", gameErr.Code),
			zap.String("error_message", gameErr.Message),
			zap.Any("details", gameErr.Details),
		)
	} else {
		// Unexpected errors (system errors, database errors, etc.)
		s.logger.Error("action failed unexpectedly",
			zap.String("action", action),
			zap.Error(err),
		)
	}

	return err
}

// HandlePlayerJoin handles a player joining the game
func (s *Session) HandlePlayerJoin(playerID, playerName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.waitingLobby.AddPlayer(playerID, playerName)

	s.logger.Info("player joined game",
		zap.String("player_id", playerID),
		zap.String("player_name", playerName),
		zap.Int("player_count", s.gameState.PlayerCount()),
	)

	return s.persistState()
}

// HandlePlayerLeave handles a player leaving the game
func (s *Session) HandlePlayerLeave(playerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.gameState.RemovePlayer(playerID)
	s.logger.Info("player left game",
		zap.String("player_id", playerID),
		zap.Int("player_count", s.gameState.PlayerCount()),
	)

	// End game if not enough players during an active game (not during waiting phase)
	if s.gameState.Phase != PhaseTypeWaiting &&
		s.gameState.PlayerCount() < s.config.Game.MinNumberPlayers {
		s.endGame()
	}

	return s.persistState()
}

// HandlePlayerReady sets a player's ready state during the waiting phase
func (s *Session) HandlePlayerReady(playerID string, ready bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.waitingLobby.SetPlayerReady(playerID, ready); err != nil {
		return s.logAndReturnError("player_ready", err)
	}

	s.logger.Info("player ready state changed",
		zap.String("player_id", playerID),
		zap.Bool("ready", ready),
	)

	return s.persistState()
}

// HandleStartGame checks if all conditions are met and starts the game
func (s *Session) HandleStartGame() (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if canStart, err := s.waitingLobby.CanStartGame(); !canStart {
		return false, s.logAndReturnError("start_game", err)
	}

	for _, player := range s.waitingLobby.Players {
		s.gameState.AddPlayer(player.ID, player.Name)
	}
	s.startGame()

	s.logger.Info("game started from waiting room",
		zap.Int("player_count", s.gameState.PlayerCount()),
	)

	s.persistState()

	return true, nil
}

// startGame transitions the game to playing phase
func (s *Session) startGame() {
	s.gameState.DrawPile = NewDeck()
	s.gameState.DrawPile.Shuffle()
	s.gameState.DiscardPile = &Deck{Cards: make([]*Card, 0)}

	s.gameState.TurnOrder = make([]string, 0, len(s.gameState.Players))
	for _, player := range s.gameState.Players {
		s.gameState.TurnOrder = append(s.gameState.TurnOrder, player.ID)
	}

	s.shuffleTurnOrder()

	// Deal cards to players (5 cards each in standard Bohnanza)
	for playerID, player := range s.gameState.Players {
		player.Hand = s.gameState.DrawPile.Draw(5)
		s.logger.Info("dealt cards to player",
			zap.String("player_id", playerID),
			zap.Int("cards_dealt", len(player.Hand)),
		)
	}

	s.gameState.SetPhase("plantHand")
	s.gameState.CurrentTurn = 0
	playerTurn := s.gameState.TurnOrder[s.gameState.CurrentTurn]
	s.state = SessionStatePlaying

	s.logger.Info("game started",
		zap.Int("player_count", s.gameState.PlayerCount()),
		zap.Int("deck_size", s.gameState.DrawPile.Size()),
		zap.Int("center_cards", len(s.gameState.CenterCards)),
		zap.String("player_turn_id", playerTurn),
	)
}

// shuffleTurnOrder randomizes the turn order
func (s *Session) shuffleTurnOrder() {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(s.gameState.TurnOrder), func(i, j int) {
		s.gameState.TurnOrder[i], s.gameState.TurnOrder[j] = s.gameState.TurnOrder[j], s.gameState.TurnOrder[i]
	})
}

// endGame transitions the game to finished phase
func (s *Session) endGame() {
	s.gameState.SetPhase("finished")
	s.logger.Info("game ended")
}

// HandlePlantBean handles planting a bean card on a field
func (s *Session) HandlePlantBean(playerID string, cardID string, slotId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.gameState.PlantBean(playerID, cardID, slotId); err != nil {
		return s.logAndReturnError("plant_bean", err)
	}

	s.logger.Info("bean planted",
		zap.String("player_id", playerID),
		zap.String("card_id", cardID),
	)

	return s.persistState()
}

// HandleTurnOverBean handles turning over a bean from the center deck
func (s *Session) HandleTurnOverBean(playerId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.gameState.TurnOverBean(playerId); err != nil {
		return s.logAndReturnError("turn_over_bean", err)
	}

	s.logger.Info("beans turned over")

	return s.persistState()
}

// HandleTradeBean handles trading a bean card between players
func (s *Session) HandleTradeBean(fromPlayerID string, toPlayerID string, cardsReceived []string, cardsGiven []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.gameState.TradeBeans(fromPlayerID, toPlayerID, cardsReceived, cardsGiven); err != nil {
		return s.logAndReturnError("trade_bean", err)
	}

	s.logger.Info("bean traded",
		zap.String("from_player_id", fromPlayerID),
		zap.String("to_player_id", toPlayerID),
	)

	return s.persistState()
}

// HandleHarvestField handles harvesting a field
func (s *Session) HandleHarvestField(playerID, slotId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.gameState.HarvestField(playerID, slotId); err != nil {
		return s.logAndReturnError("harvest_field", err)
	}

	s.logger.Info("field harvested",
		zap.String("player_id", playerID),
		zap.String("slot_id", slotId),
	)

	return s.persistState()
}

// HandleDrawCards handles drawing a card from the middle
func (s *Session) HandleDrawCards(playerId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// RULE: Can only draw 3 cards from the deck when ending the turn
	cardsToDraw := 3
	if err := s.gameState.DrawCards(playerId, cardsToDraw); err != nil {
		return s.logAndReturnError("draw_cards", err)
	}

	s.logger.Info("cards drawn",
		zap.String("player_id", playerId),
		zap.Int("cards_drawn", cardsToDraw),
	)

	return s.persistState()
}

// HandleCreateOffer handles a player creating a new root offer.
func (s *Session) HandleCreateOffer(creatorID, targetID string, cardsOffered, cardsRequested []OfferCard) (*Offer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	offer, err := s.gameState.CreateOffer(creatorID, targetID, cardsOffered, cardsRequested)
	if err != nil {
		return nil, s.logAndReturnError("create_offer", err)
	}

	s.logger.Info("offer created",
		zap.String("offer_id", offer.ID),
		zap.String("creator_id", creatorID),
		zap.String("target_id", targetID),
	)

	return offer, s.persistState()
}

// HandleCounterOffer handles a player creating a counteroffer against an existing offer.
func (s *Session) HandleCounterOffer(parentOfferID, creatorID string, cardsOffered, cardsRequested []OfferCard) (*Offer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	offer, err := s.gameState.CounterOffer(parentOfferID, creatorID, cardsOffered, cardsRequested)
	if err != nil {
		return nil, s.logAndReturnError("counter_offer", err)
	}

	s.logger.Info("counteroffer created",
		zap.String("offer_id", offer.ID),
		zap.String("parent_offer_id", parentOfferID),
		zap.String("creator_id", creatorID),
	)

	return offer, s.persistState()
}

// HandleRespondOffer handles a player accepting, rejecting, or cancelling an offer.
// action must be one of "accept", "reject", "cancel".
func (s *Session) HandleRespondOffer(offerID, playerID, action string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var err error
	switch action {
	case "accept":
		err = s.gameState.AcceptOffer(offerID, playerID)
	case "reject":
		err = s.gameState.RejectOffer(offerID, playerID)
	case "cancel":
		err = s.gameState.CancelOffer(offerID, playerID)
	default:
		return NewInvalidActionError("action must be one of: accept, reject, cancel")
	}

	if err != nil {
		return s.logAndReturnError("respond_offer", err)
	}

	s.logger.Info("offer responded",
		zap.String("offer_id", offerID),
		zap.String("player_id", playerID),
		zap.String("action", action),
	)

	return s.persistState()
}

// LoadFromStorage loads game state from Redis
func (s *Session) LoadFromStorage(ctx context.Context) error {
	if s.repo == nil {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var state State
	if err := s.repo.GetGameState(ctx, s.gameState.RoomID, &state); err != nil {
		return err
	}
	s.gameState = &state

	// Also reload the waiting lobby so cross-instance joins are visible.
	var lobby WaitingLobby
	if err := s.repo.GetWaitingLobby(ctx, s.gameState.RoomID, &lobby); err == nil {
		// Preserve config values that are not persisted.
		lobby.MinPlayers = s.waitingLobby.MinPlayers
		lobby.MaxPlayers = s.waitingLobby.MaxPlayers
		if lobby.Players == nil {
			lobby.Players = make(map[string]*WaitingPlayer)
		}
		s.waitingLobby = &lobby
	}

	s.logger.Info("game state loaded from storage",
		zap.Int("player_count", s.gameState.PlayerCount()),
		zap.String("phase", string(s.gameState.Phase)),
		zap.Int("lobby_players", len(s.waitingLobby.Players)),
	)

	return nil
}

// persistState persists the current game state and waiting lobby to Redis.
// The game state write is guarded by a dirty flag to skip redundant
// serialisation when nothing has changed.  The waiting lobby is always
// written because lobby mutations (join/leave/ready) don't go through the
// game.State mutation methods.
func (s *Session) persistState() error {
	if s.repo == nil {
		return nil
	}
	ctx := context.Background()

	// Only persist game state when it has actually changed.
	if s.gameState.IsDirty() {
		if err := s.repo.SaveGameState(ctx, s.gameState.RoomID, s.gameState); err != nil {
			s.logger.Error("failed to save game state", zap.Error(err))
			return err
		}
		s.gameState.ClearDirty()
	}

	if err := s.repo.SaveWaitingLobby(ctx, s.gameState.RoomID, s.waitingLobby); err != nil {
		s.logger.Error("failed to save waiting lobby", zap.Error(err))
		return err
	}
	return nil
}
