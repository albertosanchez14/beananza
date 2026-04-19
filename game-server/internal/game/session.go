package game

import (
	"context"
	"math/rand"
	"sort"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/storage"
)

// timerEntry wraps a time.AfterFunc timer with a cancelled flag that allows
// HandlePlayerReconnect to prevent a racing callback from acting after the
// player has already rejoined.
type timerEntry struct {
	timer     *time.Timer
	cancelled bool
}

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

	// Disconnect timer state.
	// Lock ordering: timerMu is ALWAYS acquired stand-alone — never while
	// holding mu, and never held when acquiring mu.
	// disconnectDeadlines, minPlayersDeadline, and lobbyResetAt are protected
	// by mu (not timerMu) so they can be read safely inside GetPlayerSnapshot.
	timerMu             sync.Mutex
	disconnectTimers    map[string]*timerEntry
	minPlayersEntry     *timerEntry
	lobbyResetEntry     *timerEntry // protected by timerMu
	disconnectTimeout   time.Duration
	disconnectDeadlines map[string]time.Time // protected by mu
	minPlayersDeadline  *time.Time           // protected by mu
	lobbyResetAt        *time.Time           // protected by mu
	broadcastFn         func()               // protected by timerMu
	waitingBroadcastFn  func()               // protected by timerMu
}

func NewSession(roomID string, cfg *config.Config, repo *storage.Repository, logger *zap.Logger) *Session {
	return &Session{
		config:              cfg,
		gameState:           NewState(roomID),
		waitingLobby:        NewWaitingLobby(roomID, cfg.Game.MinNumberPlayers, cfg.Game.MaxNumberPlayers),
		state:               SessionStateWaiting,
		repo:                repo,
		logger:              logger.With(zap.String("room_id", roomID)),
		disconnectTimers:    make(map[string]*timerEntry),
		disconnectDeadlines: make(map[string]time.Time),
		disconnectTimeout:   time.Duration(cfg.Game.DisconnectTimeoutSecs) * time.Second,
	}
}

// SetBroadcastFn injects the function the session uses to push fresh game state
// to all local clients after a timer-driven state change.
func (s *Session) SetBroadcastFn(fn func()) {
	s.timerMu.Lock()
	s.broadcastFn = fn
	s.timerMu.Unlock()
}

// SetWaitingBroadcastFn injects the function used to push waiting-lobby state
// to all local clients (used after the lobby reset timer fires).
func (s *Session) SetWaitingBroadcastFn(fn func()) {
	s.timerMu.Lock()
	s.waitingBroadcastFn = fn
	s.timerMu.Unlock()
}

// HandlePlayerDisconnect is called when a player's WebSocket connection drops
// during an active game.  It marks the player as disconnected, records the
// skip-turn deadline, and arms two timers:
//  1. A per-player timer that skips the player's turn when it fires.
//  2. A min-players timer (started or reset) if connected count drops below
//     the configured minimum — this timer ends the game when it fires.
//
// The caller is responsible for broadcasting updated state afterwards.
func (s *Session) HandlePlayerDisconnect(playerID string, connectedIDs map[string]bool, minPlayers int) {
	// ── Update player status and record deadline (under mu) ────────────────
	deadline := time.Now().Add(s.disconnectTimeout)

	s.mu.Lock()
	_ = s.gameState.UpdatePlayerStatus(playerID, "disconnected")
	s.disconnectDeadlines[playerID] = deadline
	connectedCount := s.gameState.ConnectedPlayerCount(connectedIDs)
	startMinTimer := connectedCount < minPlayers
	isFinished := s.gameState.Phase == PhaseTypeFinished
	s.mu.Unlock()

	// If the game has finished and all players are now disconnected, reset to
	// the waiting lobby immediately instead of waiting for the scheduled timer.
	if isFinished && connectedCount == 0 {
		s.timerMu.Lock()
		if s.lobbyResetEntry != nil {
			s.lobbyResetEntry.cancelled = true
			s.lobbyResetEntry.timer.Stop()
			s.lobbyResetEntry = nil
		}
		for _, de := range s.disconnectTimers {
			de.cancelled = true
			de.timer.Stop()
		}
		s.disconnectTimers = make(map[string]*timerEntry)
		if s.minPlayersEntry != nil {
			s.minPlayersEntry.cancelled = true
			s.minPlayersEntry.timer.Stop()
			s.minPlayersEntry = nil
		}
		fn := s.waitingBroadcastFn
		s.timerMu.Unlock()

		s.mu.Lock()
		if s.gameState.Phase == PhaseTypeFinished {
			s.resetToLobby()
			_ = s.persistState()
		}
		s.mu.Unlock()

		if fn != nil {
			go fn()
		}
		return
	}

	// ── Arm per-player skip timer (under timerMu) ──────────────────────────
	s.timerMu.Lock()
	if existing, ok := s.disconnectTimers[playerID]; ok {
		existing.cancelled = true
		existing.timer.Stop()
	}
	entry := &timerEntry{}
	entry.timer = time.AfterFunc(s.disconnectTimeout, func() {
		s.timerMu.Lock()
		if entry.cancelled {
			s.timerMu.Unlock()
			return
		}
		delete(s.disconnectTimers, playerID)
		s.timerMu.Unlock()

		s.mu.Lock()
		// Guard: don't skip the turn if the game has already ended — the
		// min-players timer may have called endGame() just before this timer
		// fired, and SkipDisconnectedTurn would overwrite the "finished" phase.
		if s.gameState.Phase != PhaseTypeFinished {
			s.gameState.SkipDisconnectedTurn(playerID)
		}
		delete(s.disconnectDeadlines, playerID)
		_ = s.persistState()
		s.mu.Unlock()

		s.timerMu.Lock()
		fn := s.broadcastFn
		s.timerMu.Unlock()
		if fn != nil {
			go fn()
		}
	})
	s.disconnectTimers[playerID] = entry
	s.timerMu.Unlock()

	if !startMinTimer {
		return
	}

	// ── Arm or reset the min-players game-end timer ─────────────────────────
	minDeadline := time.Now().Add(s.disconnectTimeout)

	s.mu.Lock()
	s.minPlayersDeadline = &minDeadline
	s.mu.Unlock()

	s.timerMu.Lock()
	if s.minPlayersEntry != nil {
		s.minPlayersEntry.cancelled = true
		s.minPlayersEntry.timer.Stop()
	}
	minEntry := &timerEntry{}
	minEntry.timer = time.AfterFunc(s.disconnectTimeout, func() {
		s.timerMu.Lock()
		if minEntry.cancelled {
			s.timerMu.Unlock()
			return
		}
		s.minPlayersEntry = nil
		fn := s.broadcastFn
		s.timerMu.Unlock()

		s.mu.Lock()
		s.endGame()
		s.minPlayersDeadline = nil
		_ = s.persistState()
		s.mu.Unlock()

		s.startLobbyResetTimer()

		if fn != nil {
			go fn()
		}
	})
	s.minPlayersEntry = minEntry
	s.timerMu.Unlock()
}

// HandlePlayerReconnect is called when a disconnected player's WebSocket
// reconnects during an active game.  It cancels the player's skip timer,
// cancels the min-players timer if enough players are now connected, and marks
// the player as active.  The caller is responsible for broadcasting updated state.
func (s *Session) HandlePlayerReconnect(playerID string, connectedIDs map[string]bool, minPlayers int) {
	// ── Cancel per-player skip timer ────────────────────────────────────────
	s.timerMu.Lock()
	if entry, ok := s.disconnectTimers[playerID]; ok {
		entry.cancelled = true
		entry.timer.Stop()
		delete(s.disconnectTimers, playerID)
	}
	s.timerMu.Unlock()

	// ── Update status and compute connected count (under mu) ────────────────
	s.mu.Lock()
	_ = s.gameState.UpdatePlayerStatus(playerID, "active")
	delete(s.disconnectDeadlines, playerID)
	connectedCount := s.gameState.ConnectedPlayerCount(connectedIDs)
	s.mu.Unlock()

	if connectedCount < minPlayers {
		return
	}

	// ── Cancel min-players timer (enough players reconnected) ────────────────
	s.timerMu.Lock()
	if s.minPlayersEntry != nil {
		s.minPlayersEntry.cancelled = true
		s.minPlayersEntry.timer.Stop()
		s.minPlayersEntry = nil
	}
	s.timerMu.Unlock()

	s.mu.Lock()
	s.minPlayersDeadline = nil
	s.mu.Unlock()
}

// HandleWaitingLobbyDisconnect immediately removes a player from the waiting
// lobby when their connection drops.  No timeout is applied — the slot is freed
// right away so another player can join.  The session token remains valid in
// Redis so the player can rejoin via the normal join flow.
func (s *Session) HandleWaitingLobbyDisconnect(playerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.waitingLobby.Players, playerID)
	s.waitingLobby.UpdatedAt = time.Now()

	s.logger.Info("player removed from lobby on disconnect",
		zap.String("player_id", playerID),
	)

	return s.persistState()
}

// CancelAllTimers stops all pending disconnect, min-players, and lobby-reset timers.
// Call this when the room is being cleaned up to prevent goroutine leaks.
func (s *Session) CancelAllTimers() {
	s.timerMu.Lock()
	defer s.timerMu.Unlock()

	for _, entry := range s.disconnectTimers {
		entry.cancelled = true
		entry.timer.Stop()
	}
	s.disconnectTimers = make(map[string]*timerEntry)

	if s.minPlayersEntry != nil {
		s.minPlayersEntry.cancelled = true
		s.minPlayersEntry.timer.Stop()
		s.minPlayersEntry = nil
	}

	if s.lobbyResetEntry != nil {
		s.lobbyResetEntry.cancelled = true
		s.lobbyResetEntry.timer.Stop()
		s.lobbyResetEntry = nil
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

func (s *Session) GetSessionState() SessionState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// IsInWaitingLobby reports whether the given player is currently in the waiting lobby.
func (s *Session) IsInWaitingLobby(playerID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.waitingLobby.Players[playerID]
	return ok
}

// HasPlayer reports whether the given player is a member of the active game.
// This is meaningful only when the session is in the playing or pause state.
func (s *Session) HasPlayer(playerID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.gameState.Players[playerID]
	return ok
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

	// Include discard pile size and top card (front image shown on discard pile)
	if s.gameState.DiscardPile != nil {
		snapshot["discard_pile_size"] = s.gameState.DiscardPile.Size()
		snapshot["discard_top_card"] = s.gameState.DiscardPile.PeekLast()
	} else {
		snapshot["discard_pile_size"] = 0
		snapshot["discard_top_card"] = nil
	}

	return snapshot
}

// GetPlayerSnapshot returns a complete snapshot of the session for a player
// and what that player can see. connectedIDs is the set of player IDs that
// currently have an active WebSocket connection, used to stamp a "connected"
// flag onto each external player without persisting that state to Redis.
func (s *Session) GetPlayerSnapshot(playerId string, connectedIDs map[string]bool) map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	playerData, ok := s.gameState.GetPlayer(playerId)
	if !ok {
	}

	// Include the min-players deadline if the game is paused waiting for reconnects.
	var minPlayersDeadlineStr *string
	if s.minPlayersDeadline != nil {
		formatted := s.minPlayersDeadline.UTC().Format(time.RFC3339)
		minPlayersDeadlineStr = &formatted
	}

	// Include the lobby-reset deadline when the game has ended.
	var lobbyResetAtStr *string
	if s.lobbyResetAt != nil {
		formatted := s.lobbyResetAt.UTC().Format(time.RFC3339)
		lobbyResetAtStr = &formatted
	}

	snapshot := map[string]any{
		"room_id":              s.gameState.RoomID,
		"phase":                s.gameState.Phase,
		"player":               playerData,
		"turn_order":           s.gameState.TurnOrder,
		"current_turn":         s.gameState.CurrentTurn,
		"center_cards":         s.gameState.CenterCards,
		"offers":               s.gameState.GetOffersForPlayer(playerId),
		"started_at":           s.gameState.StartedAt,
		"ended_at":             s.gameState.EndedAt,
		"updated_at":           s.gameState.UpdatedAt,
		"min_players_deadline": minPlayersDeadlineStr,
		"lobby_reset_at":       lobbyResetAtStr,
	}

	// Include deck size but not the actual deck contents
	if s.gameState.DrawPile != nil {
		snapshot["deck_size"] = s.gameState.DrawPile.Size()
	} else {
		snapshot["deck_size"] = 0
	}

	// Include discard pile size and top card (front image shown on discard pile)
	if s.gameState.DiscardPile != nil {
		snapshot["discard_pile_size"] = s.gameState.DiscardPile.Size()
		snapshot["discard_top_card"] = s.gameState.DiscardPile.PeekLast()
	} else {
		snapshot["discard_pile_size"] = 0
		snapshot["discard_top_card"] = nil
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
		var deadlineStr *string
		if dl, hasDl := s.disconnectDeadlines[id]; hasDl {
			formatted := dl.UTC().Format(time.RFC3339)
			deadlineStr = &formatted
		}
		externalPlayerData := map[string]any{
			"playerId":                    player.ID,
			"playerName":                  player.Name,
			"playerAvatar":                player.Avatar,
			"playerStatus":                player.Status,
			"playerCoins":                 player.Coins,
			"playerHandSize":              len(player.Hand),
			"playerPickedCardsCount":      len(player.PickedCards),
				"playerPickedCards":           player.PickedCards,
			"playerField":                 player.Field,
			"playerConnected":             connectedIDs[id],
			"playerDisconnectDeadline":    deadlineStr,
		}
		externalPlayers = append(externalPlayers, externalPlayerData)
	}
	snapshot["external_players"] = externalPlayers

	if s.gameState.Phase == "finished" {
		type rankedPlayer struct {
			PlayerID   string `json:"playerId"`
			PlayerName string `json:"playerName"`
			Avatar     string `json:"playerAvatar,omitempty"`
			Coins      int    `json:"playerCoins"`
		}
		ranked := make([]rankedPlayer, 0, len(s.gameState.Players))
		for _, p := range s.gameState.Players {
			ranked = append(ranked, rankedPlayer{
				PlayerID:   p.ID,
				PlayerName: p.Name,
				Avatar:     p.Avatar,
				Coins:      p.Coins,
			})
		}
		turnIdx := make(map[string]int, len(s.gameState.TurnOrder))
		for i, id := range s.gameState.TurnOrder {
			turnIdx[id] = i
		}
		sort.Slice(ranked, func(i, j int) bool {
			if ranked[i].Coins != ranked[j].Coins {
				return ranked[i].Coins > ranked[j].Coins
			}
			return turnIdx[ranked[i].PlayerID] > turnIdx[ranked[j].PlayerID]
		})
		snapshot["ranked_players"] = ranked
	}

	return snapshot
}

// GetWaitingLobbySnapshot returns a snapshot of the waiting lobby.
// connectedIDs is the set of player IDs with an active WebSocket connection,
// stamped onto each player entry without being persisted to Redis.
func (s *Session) GetWaitingLobbySnapshot(connectedIDs map[string]bool) map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	canStart, _ := s.waitingLobby.CanStartGame()

	players := make(map[string]any, len(s.waitingLobby.Players))
	for id, p := range s.waitingLobby.Players {
		if !connectedIDs[id] {
			continue // omit disconnected players from the snapshot
		}
		players[id] = map[string]any{
			"id":        p.ID,
			"name":      p.Name,
			"avatar":    p.Avatar,
			"ready":     p.Ready,
			"joined_at": p.JoinedAt,
		}
	}

	snapshot := map[string]any{
		"players":     players,
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
func (s *Session) HandlePlayerJoin(playerID, playerName, avatar string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.waitingLobby.AddPlayer(playerID, playerName, avatar); err != nil {
		return err
	}

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

	s.gameState.RemovePlayer(playerID)
	s.logger.Info("player left game",
		zap.String("player_id", playerID),
		zap.Int("player_count", s.gameState.PlayerCount()),
	)

	gameEnded := false
	if s.gameState.Phase != PhaseTypeWaiting &&
		s.gameState.Phase != PhaseTypeFinished &&
		s.gameState.PlayerCount() < s.config.Game.MinNumberPlayers {
		s.endGame()
		gameEnded = true
	}

	persistErr := s.persistState()
	s.mu.Unlock()

	if gameEnded {
		s.startLobbyResetTimer()
	}

	return persistErr
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
		s.gameState.AddPlayer(player.ID, player.Name, player.Avatar)
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
	s.gameState.Cards = s.config.Game.Cards
	s.gameState.CardsPerTurn = s.config.Game.CardsPerTurn
	s.gameState.CardsPerDraw = s.config.Game.CardsPerDraw
	s.gameState.DrawPile = NewDeck(s.config.Game.Cards)
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

// endGame transitions the game to finished phase and records the lobby reset
// deadline. Must be called with s.mu held.
// After releasing s.mu, callers must call startLobbyResetTimer().
func (s *Session) endGame() {
	s.gameState.SetPhase("finished")
	s.state = SessionStatePause
	resetAt := time.Now().Add(time.Duration(s.config.Game.LobbyResetSecs) * time.Second)
	s.lobbyResetAt = &resetAt
	s.logger.Info("game ended", zap.Time("lobby_reset_at", resetAt))
}

// startLobbyResetTimer arms the lobby-reset timer using the deadline already
// stored in s.lobbyResetAt. Must be called WITHOUT holding s.mu.
func (s *Session) startLobbyResetTimer() {
	s.mu.RLock()
	resetAt := s.lobbyResetAt
	s.mu.RUnlock()
	if resetAt == nil {
		return
	}

	s.timerMu.Lock()
	// Cancel any existing reset timer before arming a new one.
	if s.lobbyResetEntry != nil {
		s.lobbyResetEntry.cancelled = true
		s.lobbyResetEntry.timer.Stop()
	}
	entry := &timerEntry{}
	entry.timer = time.AfterFunc(time.Until(*resetAt), func() {
		s.timerMu.Lock()
		if entry.cancelled {
			s.timerMu.Unlock()
			return
		}
		s.lobbyResetEntry = nil
		// Cancel all game timers before resetting state.
		for _, de := range s.disconnectTimers {
			de.cancelled = true
			de.timer.Stop()
		}
		s.disconnectTimers = make(map[string]*timerEntry)
		if s.minPlayersEntry != nil {
			s.minPlayersEntry.cancelled = true
			s.minPlayersEntry.timer.Stop()
			s.minPlayersEntry = nil
		}
		fn := s.waitingBroadcastFn
		s.timerMu.Unlock()

		s.mu.Lock()
		if s.gameState.Phase == PhaseTypeFinished {
			s.resetToLobby()
			_ = s.persistState()
		}
		s.mu.Unlock()

		if fn != nil {
			go fn()
		}
	})
	s.lobbyResetEntry = entry
	s.timerMu.Unlock()
}

// EnsureLobbyResetTimer starts the lobby reset timer if the game is in the
// finished phase and no timer is already running. Safe to call multiple times.
// Must be called WITHOUT holding s.mu.
func (s *Session) EnsureLobbyResetTimer() {
	s.mu.Lock()
	phase := s.gameState.Phase
	if phase == PhaseTypeFinished && s.lobbyResetAt == nil {
		// Server restarted while in finished state — restart with full duration.
		resetAt := time.Now().Add(time.Duration(s.config.Game.LobbyResetSecs) * time.Second)
		s.lobbyResetAt = &resetAt
	}
	s.mu.Unlock()

	s.timerMu.Lock()
	alreadyRunning := s.lobbyResetEntry != nil
	s.timerMu.Unlock()

	if phase == PhaseTypeFinished && !alreadyRunning {
		s.startLobbyResetTimer()
	}
}

// resetToLobby wipes the game state and returns the room to the waiting lobby.
// Only players who were still active (not disconnected or explicitly left) at the
// time of the reset are re-added; disconnected/left players are dropped.
// Must be called with s.mu held.
func (s *Session) resetToLobby() {
	roomID := s.gameState.RoomID

	type playerInfo struct{ id, name, avatar string }
	existing := make([]playerInfo, 0, len(s.gameState.Players))
	for _, p := range s.gameState.Players {
		// Skip players who disconnected — they were never actively present at
		// the end of the game. Players who explicitly left are already absent
		// from s.gameState.Players (removed by HandlePlayerLeave).
		if p.Status == "disconnected" {
			continue
		}
		existing = append(existing, playerInfo{p.ID, p.Name, p.Avatar})
	}

	s.gameState = NewState(roomID)
	s.gameState.markDirty()
	s.state = SessionStateWaiting
	s.lobbyResetAt = nil
	s.disconnectDeadlines = make(map[string]time.Time)
	s.minPlayersDeadline = nil

	s.waitingLobby = NewWaitingLobby(roomID, s.config.Game.MinNumberPlayers, s.config.Game.MaxNumberPlayers)
	for _, p := range existing {
		_ = s.waitingLobby.AddPlayer(p.id, p.name, p.avatar)
	}

	s.logger.Info("lobby reset after game end", zap.Int("player_count", len(existing)))
}

// HandlePlantBean handles planting a bean card on a field
func (s *Session) HandlePlantBean(playerID string, cardID string, slotId string) error {
	s.mu.Lock()

	plantErr := s.gameState.PlantBean(playerID, cardID, slotId)

	gameEnded := false
	if gameErr, ok := plantErr.(*GameError); ok && gameErr.Code == ErrCodeInsufficientCards {
		s.endGame()
		gameEnded = true
		plantErr = nil
	}

	if persistErr := s.persistState(); persistErr != nil {
		s.logger.Error("failed to persist state after plant bean", zap.Error(persistErr))
	}
	s.mu.Unlock()

	if gameEnded {
		s.startLobbyResetTimer()
	}

	if plantErr != nil {
		return s.logAndReturnError("plant_bean", plantErr)
	}

	s.logger.Info("bean planted",
		zap.String("player_id", playerID),
		zap.String("card_id", cardID),
	)
	return nil
}

// HandleTurnOverBean handles turning over a bean from the center deck
func (s *Session) HandleTurnOverBean(playerId string) error {
	s.mu.Lock()

	turnErr := s.gameState.TurnOverBean(playerId)

	gameEnded := false
	if gameErr, ok := turnErr.(*GameError); ok && gameErr.Code == ErrCodeDeckEmpty {
		s.endGame()
		gameEnded = true
		turnErr = nil
	} else if s.gameState.ReshuffleCount >= s.config.Game.MaxReshuffles &&
		s.gameState.Phase != PhaseTypeFinished {
		s.endGame()
		gameEnded = true
	}

	if persistErr := s.persistState(); persistErr != nil {
		s.logger.Error("failed to persist state after turn over bean", zap.Error(persistErr))
	}
	s.mu.Unlock()

	if gameEnded {
		s.startLobbyResetTimer()
	}

	if turnErr != nil {
		return s.logAndReturnError("turn_over_bean", turnErr)
	}

	s.logger.Info("beans turned over")
	return nil
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

	drawErr := s.gameState.DrawCards(playerId, s.gameState.CardsPerDraw)

	gameEnded := false
	if gameErr, ok := drawErr.(*GameError); ok && gameErr.Code == ErrCodeInsufficientCards {
		s.endGame()
		gameEnded = true
		drawErr = nil
	} else if s.gameState.Phase != PhaseTypeFinished {
		pilesEmpty := s.gameState.DrawPile.IsEmpty() && s.gameState.DiscardPile.IsEmpty()
		if s.gameState.ReshuffleCount >= s.config.Game.MaxReshuffles || pilesEmpty {
			s.endGame()
			gameEnded = true
		}
	}

	// Always persist: the phase may have advanced even if drawing was deferred.
	if persistErr := s.persistState(); persistErr != nil {
		s.logger.Error("failed to persist state after draw cards", zap.Error(persistErr))
	}
	s.mu.Unlock()

	if gameEnded {
		s.startLobbyResetTimer()
	}

	if drawErr != nil {
		return s.logAndReturnError("draw_cards", drawErr)
	}

	s.logger.Info("draw cards action processed", zap.String("player_id", playerId))
	return nil
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
func (s *Session) HandleCounterOffer(parentOfferID, creatorID, targetID string, cardsOffered, cardsRequested []OfferCard) (*Offer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	offer, err := s.gameState.CounterOffer(parentOfferID, creatorID, targetID, cardsOffered, cardsRequested)
	if err != nil {
		return nil, s.logAndReturnError("counter_offer", err)
	}

	s.logger.Info("counteroffer created",
		zap.String("offer_id", offer.ID),
		zap.String("parent_offer_id", parentOfferID),
		zap.String("creator_id", creatorID),
		zap.String("target_id", offer.TargetID),
	)

	return offer, s.persistState()
}

// HandleRespondOffer handles a player accepting, rejecting, or cancelling an offer.
// action must be one of "accept", "reject", "cancel".
func (s *Session) HandleRespondOffer(offerID, playerID, action string, selectedCards []OfferCard) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var err error
	switch action {
	case "accept":
		err = s.gameState.AcceptOffer(offerID, playerID, selectedCards)
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

	// Infer the in-memory session state from the persisted game phase so that
	// IsPlaying() returns the correct answer after a reload or cross-instance load.
	switch s.gameState.Phase {
	case PhaseTypeWaiting:
		s.state = SessionStateWaiting
	case PhaseTypeFinished:
		s.state = SessionStatePause
	default: // plantHand, turnTrade, plantTrade, drawCards — game is active
		s.state = SessionStatePlaying
	}

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
