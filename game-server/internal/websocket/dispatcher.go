package websocket

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/game"
	"github.com/yourusername/game-server/pkg/protocol"
)

// handleJoin processes a "join" message: binds the player to a room and
// session, then signals all instances via pub/sub to push fresh lobby state.
// By the time this is called, ReadPump has already authenticated the message
// and populated c.PlayerId / c.PlayerName from the server-side profile.
func (c *Client) handleJoin(msg *protocol.Message) {
	var payload protocol.JoinPayload
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid join payload")
		return
	}

	if c.PlayerId == "" {
		c.PlayerId = c.ID // fallback for dev mode (no Redis / no auth)
	}

	room := c.hub.GetOrCreateRoom(msg.RoomID)

	// Check whether a session already exists and what state it is in.
	if existingSession, ok := c.hub.gameManager.GetSession(msg.RoomID); ok {
		sessionState := existingSession.GetSessionState()
		if sessionState == game.SessionStatePlaying || sessionState == game.SessionStatePause {
			// Game is running. Only let the player back in if they are already a
			// member of this game (i.e. they disconnected and are rejoining).
			if !existingSession.HasPlayer(c.PlayerId) {
				c.sendError(game.ErrCodeGameAlreadyStarted, "Cannot join: game is already in progress")
				return
			}
			// Recognised player — bind them to the room and cancel their skip timer.
			room.Join(c)
			c.room = room
			c.hub.ensureSessionHooks(msg.RoomID, existingSession)
			connectedIDs := room.GetConnectedPlayerIDs()
			existingSession.HandlePlayerReconnect(
				c.PlayerId,
				connectedIDs,
				c.hub.config.Game.MinNumberPlayers,
			)
			c.sendJoined(msg.RoomID, string(sessionState))
			c.hub.EnqueueFanout(msg.RoomID, existingSession)
			return
		}
	}

	room.Join(c)
	c.room = room

	session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)
	if avatar, ok := payload.Metadata["avatar"].(string); ok {
		c.Avatar = avatar
	}

	if err := session.HandlePlayerJoin(c.PlayerId, c.PlayerName, c.Avatar); err != nil {
		// Most likely WAITING_ROOM_FULL — report it and leave the room.
		c.sendGameError(err)
		room.Leave(c)
		c.room = nil
		return
	}

	c.logger.Info("player joined room",
		zap.String("room_id", msg.RoomID),
		zap.String("player_name", payload.PlayerName),
	)

	c.hub.SyncRoomRegistry(msg.RoomID)

	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.AddPlayerToRoom(ctx, msg.RoomID, c.PlayerId)

		// Issue a session token so the client can reconnect after a disconnect.
		token := uuid.NewString()
		if err := c.hub.repo.SaveSessionToken(ctx, token, c.PlayerId); err != nil {
			c.logger.Warn("failed to save session token", zap.Error(err))
		} else {
			joinedMsg, err := protocol.NewMessage(
				protocol.MessageTypeJoined,
				msg.RoomID,
				c.PlayerId,
				protocol.JoinedPayload{
					PlayerID:     c.PlayerId,
					SessionToken: token,
					SessionState: string(game.SessionStateWaiting),
				},
			)
			if err == nil {
				if data, err := joinedMsg.ToJSON(); err == nil {
					c.Send(data)
				}
			}
		}
	}

	// Push the current waiting lobby state directly to this client so they
	// see the lobby immediately without waiting for the next broadcast event.
	c.hub.SendWaitingLobbyToClient(c, msg.RoomID)

	// Broadcast player_joined to the rest of the room.
	playerJoinedMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		msg.RoomID,
		c.PlayerId,
		protocol.BroadcastPayload{
			Event: protocol.EventPlayerJoined,
			Data: map[string]any{
				"player_id":   c.PlayerId,
				"player_name": c.PlayerName,
				"avatar":      c.Avatar,
				"ready":       false,
			},
		},
	)
	if err == nil {
		c.room.Broadcast(playerJoinedMsg, c)
	}
}

// handleLeave processes a "leave" message: removes the player from the session
// and room, then updates the shared registry.
func (c *Client) handleLeave() {
	if c.room == nil {
		return
	}

	if session, ok := c.hub.gameManager.GetSession(c.room.ID); ok {
		if err := session.HandlePlayerLeave(c.PlayerId); err != nil {
			c.logger.Error("failed to remove player from game session", zap.Error(err))
		}
	}

	c.room.Leave(c)

	c.logger.Info("player left room",
		zap.String("room_id", c.room.ID),
	)

	c.hub.SyncRoomRegistry(c.room.ID)

	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.RemovePlayerFromRoom(ctx, c.room.ID, c.PlayerId)
	}

	c.room = nil
}

// handleReady processes a "ready" message: marks the player ready and, if all
// conditions are met, starts the game and broadcasts the event to all instances.
func (c *Client) handleReady(msg *protocol.Message) {
	if c.room == nil {
		c.sendError("not_in_room", "You must join a room first")
		return
	}

	var payload protocol.ReadyPayload
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid ready payload")
		return
	}

	session, ok := c.hub.gameManager.GetSession(c.room.ID)
	if !ok {
		c.sendError("session_not_found", "Game session not found")
		return
	}

	if err := session.HandlePlayerReady(c.PlayerId, payload.Ready); err != nil {
		c.sendGameError(err)
		return
	}

	// Signal all instances (including this one) via pub/sub that a ready
	// state changed — handlePubSubMessage will push fresh lobby state.
	readyMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		c.room.ID,
		c.PlayerId,
		protocol.BroadcastPayload{
			Event: protocol.EventPlayerReady,
			Data: map[string]any{
				"player_id": c.PlayerId,
				"ready":     payload.Ready,
			},
		},
	)
	if err != nil {
		c.logger.Error("failed to create player_ready broadcast", zap.Error(err))
	} else {
		c.room.Broadcast(readyMsg, c)
	}

	// Check if the game can auto-start now that ready state changed.
	started, err := session.HandleStartGame()
	if err != nil {
		c.logger.Debug("game cannot start yet", zap.Error(err))
		return
	}

	if started {
		gameStartedMsg, err := protocol.NewMessage(
			protocol.MessageTypeBroadcast,
			c.room.ID,
			c.PlayerId,
			protocol.BroadcastPayload{
				Event: protocol.EventGameStarted,
				Data:  map[string]any{},
			},
		)
		if err != nil {
			c.logger.Error("failed to create game_started broadcast", zap.Error(err))
			return
		}
		c.room.Broadcast(gameStartedMsg, c)
		// Fan out personalised state asynchronously through the hub.
		c.hub.EnqueueFanout(c.room.ID, session)
	}
}

// handleAction routes an "action" message to the appropriate sub-handler and,
// on success, fans out fresh state to all local clients and notifies remote
// instances via pub/sub.
func (c *Client) handleAction(msg *protocol.Message) {
	if c.room == nil {
		c.sendError("not_in_room", "You must join a room first")
		return
	}

	var payload map[string]any
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid action payload")
		return
	}

	actionType, ok := payload["type"].(string)
	if !ok {
		c.sendError("invalid_action", "Action type missing")
		return
	}

	session, ok := c.hub.gameManager.GetSession(c.room.ID)
	if !ok {
		c.sendError("session_not_found", "Game session not found")
		return
	}

	switch actionType {
	case "plantBean":
		c.handlePlantBean(session, payload)
	case "tradeBean":
		c.handleTradeBean(session, payload)
	case "harvestField":
		c.handleHarvestField(session, payload)
	case "turnOverBean":
		c.handleTurnOverBean(session)
	case "drawCards":
		c.handleDrawCards(session)
	case "createOffer":
		c.handleCreateOffer(session, payload)
	case "counterOffer":
		c.handleCounterOffer(session, payload)
	case "respondOffer":
		c.handleRespondOffer(session, payload)
	default:
		c.sendError("unknown_action", "Unknown action type")
		return
	}

	// Fan out fresh personalised snapshots to all local clients asynchronously
	// via the hub's event loop — decouples the ReadPump from O(N) marshal work.
	c.hub.EnqueueFanout(c.room.ID, session)

	// Signal other instances via pub/sub so they can push fresh state to
	// their own local clients.
	stateUpdatedMsg, err := protocol.NewMessage(
		protocol.MessageTypeBroadcast,
		c.room.ID,
		c.PlayerId,
		protocol.BroadcastPayload{
			Event: protocol.EventStateUpdated,
			Data:  map[string]any{},
		},
	)
	if err == nil {
		c.room.Broadcast(stateUpdatedMsg, c)
	}
}

// handleReconnect processes a "reconnect" message: re-binds the client to an
// existing game session using a session token stored in Redis.
func (c *Client) handleReconnect(msg *protocol.Message) {
	var payload protocol.ReconnectPayload
	if err := msg.ParsePayload(&payload); err != nil || payload.SessionToken == "" {
		c.sendError("invalid_payload", "Invalid reconnect payload")
		return
	}

	if c.hub.repo == nil {
		c.sendError("reconnect_unavailable", "Reconnect not supported without storage")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	playerID, err := c.hub.repo.GetSessionToken(ctx, payload.SessionToken)
	if err != nil || playerID == "" {
		c.sendError("invalid_token", "Session token not found or expired")
		return
	}

	c.PlayerId = playerID
	c.PlayerName = payload.PlayerName

	room := c.hub.GetOrCreateRoom(msg.RoomID)
	room.Join(c)
	c.room = room

	// Re-add to Redis player set so other handlers see a consistent view.
	_ = c.hub.repo.AddPlayerToRoom(ctx, msg.RoomID, c.PlayerId)

	session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)
	if err := session.LoadFromStorage(ctx); err != nil {
		c.logger.Warn("failed to reload session on reconnect",
			zap.String("room_id", msg.RoomID),
			zap.Error(err),
		)
	}

	c.logger.Info("player reconnected",
		zap.String("room_id", msg.RoomID),
		zap.String("player_id", playerID),
	)

	// Cancel any pending skip/end-game timers for this player.
	if session.IsPlaying() {
		c.hub.ensureSessionHooks(msg.RoomID, session)
		connectedIDs := room.GetConnectedPlayerIDs()
		session.HandlePlayerReconnect(
			c.PlayerId,
			connectedIDs,
			c.hub.config.Game.MinNumberPlayers,
		)
	}

	// Send a joined message with the current session state so the client
	// can route to the correct view immediately on reconnect.
	c.sendJoined(msg.RoomID, string(session.GetSessionState()))

	// Send the player their current game state immediately.
	c.hub.EnqueueFanout(msg.RoomID, session)

	// If the game hasn't started yet, broadcast the waiting lobby to all clients
	// so their connection-status indicators update when this player reconnects.
	if !session.IsPlaying() {
		go c.hub.BroadcastWaitingLobbyToRoom(msg.RoomID)
	}
}

// ----------------------------------------------------------------------------
// Action sub-handlers
// ----------------------------------------------------------------------------

func (c *Client) handlePlantBean(s *game.Session, payload map[string]any) {
	cardID, _ := payload["cardId"].(string)
	slotId, _ := payload["slotId"].(string)

	if cardID == "" || slotId == "" {
		c.sendError("invalid_params", "Missing cardId or slotId")
		return
	}

	if err := s.HandlePlantBean(c.PlayerId, cardID, slotId); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleTradeBean(s *game.Session, payload map[string]any) {
	fromPlayerID, _ := payload["fromPlayerId"].(string)
	toPlayerID, _ := payload["toPlayerId"].(string)

	cardsGivenRaw, _ := payload["cardsGiven"].([]interface{})
	cardsReceivedRaw, _ := payload["cardsReceived"].([]interface{})

	cardsGiven := make([]string, 0, len(cardsGivenRaw))
	for _, v := range cardsGivenRaw {
		if id, ok := v.(string); ok {
			cardsGiven = append(cardsGiven, id)
		}
	}

	cardsReceived := make([]string, 0, len(cardsReceivedRaw))
	for _, v := range cardsReceivedRaw {
		if id, ok := v.(string); ok {
			cardsReceived = append(cardsReceived, id)
		}
	}

	if fromPlayerID == "" || toPlayerID == "" {
		c.sendError("invalid_params", "Missing fromPlayerId or toPlayerId")
		return
	}

	if err := s.HandleTradeBean(fromPlayerID, toPlayerID, cardsReceived, cardsGiven); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleCreateOffer(s *game.Session, payload map[string]any) {
	targetID, _ := payload["target_player_id"].(string)
	cardsOffered := parseOfferCards(payload["cards_offered"])
	cardsRequested := parseOfferCards(payload["cards_requested"])

	if _, err := s.HandleCreateOffer(c.PlayerId, targetID, cardsOffered, cardsRequested); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleCounterOffer(s *game.Session, payload map[string]any) {
	parentOfferID, _ := payload["parent_offer_id"].(string)
	if parentOfferID == "" {
		c.sendError("invalid_params", "Missing parent_offer_id")
		return
	}

	cardsOffered := parseOfferCards(payload["cards_offered"])
	cardsRequested := parseOfferCards(payload["cards_requested"])

	if _, err := s.HandleCounterOffer(parentOfferID, c.PlayerId, cardsOffered, cardsRequested); err != nil {
		c.sendGameError(err)
	}
}

// handleRespondOffer handles the "respondOffer" action.
// The "action" field in the payload must be "accept", "reject", or "cancel".
func (c *Client) handleRespondOffer(s *game.Session, payload map[string]any) {
	offerID, _ := payload["offer_id"].(string)
	action, _ := payload["action"].(string)

	if offerID == "" || action == "" {
		c.sendError("invalid_params", "Missing offer_id or action")
		return
	}

	var selectedCards []game.OfferCard
	if raw, ok := payload["cards_to_give"].([]interface{}); ok {
		for _, item := range raw {
			if m, ok := item.(map[string]interface{}); ok {
				cardType, _ := m["card_type"].(string)
				cardID, _ := m["card_id"].(string)
				selectedCards = append(selectedCards, game.OfferCard{
					CardType: game.CardType(cardType),
					CardID:   cardID,
				})
			}
		}
	}

	if err := s.HandleRespondOffer(offerID, c.PlayerId, action, selectedCards); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleHarvestField(s *game.Session, payload map[string]any) {
	slotId, _ := payload["slotId"].(string)

	if slotId == "" {
		c.sendError("invalid_params", "Missing slotId")
		return
	}

	if err := s.HandleHarvestField(c.PlayerId, slotId); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleTurnOverBean(s *game.Session) {
	if err := s.HandleTurnOverBean(c.PlayerId); err != nil {
		c.sendGameError(err)
	}
}

func (c *Client) handleDrawCards(s *game.Session) {
	if err := s.HandleDrawCards(c.PlayerId); err != nil {
		c.sendGameError(err)
	}
}

// parseOfferCards converts a raw JSON-decoded []interface{} into []game.OfferCard.
func parseOfferCards(raw interface{}) []game.OfferCard {
	slice, ok := raw.([]interface{})
	if !ok {
		return []game.OfferCard{}
	}
	result := make([]game.OfferCard, 0, len(slice))
	for _, item := range slice {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		cardType, _ := m["card_type"].(string)
		cardID, _ := m["card_id"].(string)
		result = append(result, game.OfferCard{
			CardType: game.CardType(cardType),
			CardID:   cardID,
		})
	}
	return result
}
