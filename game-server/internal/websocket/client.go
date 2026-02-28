package websocket

import (
	"context"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/game"
	"github.com/yourusername/game-server/pkg/protocol"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 8192
)

// Client represents a WebSocket client connection
type Client struct {
	ID         string
	conn       *websocket.Conn
	hub        *Hub
	room       *Room
	send       chan []byte
	PlayerId   string
	PlayerName string
	logger     *zap.Logger
	ctx        context.Context
	cancel     context.CancelFunc
}

func NewClient(id string, conn *websocket.Conn, hub *Hub, logger *zap.Logger) *Client {
	ctx, cancel := context.WithCancel(context.Background())

	return &Client{
		ID:     id,
		conn:   conn,
		hub:    hub,
		send:   make(chan []byte, 256),
		logger: logger.With(zap.String("client_id", id)),
		ctx:    ctx,
		cancel: cancel,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
		c.cancel()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, messageData, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Error("websocket error", zap.Error(err))
			}
			break
		}

		// Parse the incoming message
		msg, err := protocol.FromJSON(messageData)
		if err != nil {
			c.logger.Error("failed to parse message", zap.Error(err))
			c.sendError("invalid_message", "Failed to parse message")
			continue
		}

		// Set player ID from message if not already set
		if c.PlayerId == "" && msg.PlayerID != "" {
			c.PlayerId = msg.PlayerID
		}

		c.handleMessage(msg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

			// Send queued messages as individual WebSocket frames
			n := len(c.send)
			for range n {
				c.conn.SetWriteDeadline(time.Now().Add(writeWait))
				if err := c.conn.WriteMessage(websocket.TextMessage, <-c.send); err != nil {
					return
				}
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-c.ctx.Done():
			return
		}
	}
}

func (c *Client) handleMessage(msg *protocol.Message) {
	c.logger.Debug("received message",
		zap.String("type", string(msg.Type)),
		zap.String("room_id", msg.RoomID),
	)

	session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)

	switch msg.Type {
	case protocol.MessageTypeJoin:
		c.handleJoin(msg)
	case protocol.MessageTypeLeave:
		c.handleLeave(msg)
	case protocol.MessageTypeReady:
		c.handleReady(msg)
	case protocol.MessageTypeAction:
		c.handleAction(msg)
	case protocol.MessageTypeState:
		c.sendGameState(msg.RoomID, session)
	case protocol.MessageTypePlayerState:
		c.handlePlayerState(msg)
	default:
		c.sendError("unknown_message_type", "Unknown message type")
	}
}

func (c *Client) handleJoin(msg *protocol.Message) {
	var payload protocol.JoinPayload
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid join payload")
		return
	}

	// TODO: PlayerId should be obtained by auth
	c.PlayerName = payload.PlayerName
	if c.PlayerId == "" {
		c.PlayerId = c.ID // Use client ID as player ID if not set
	}

	room := c.hub.GetOrCreateRoom(msg.RoomID)
	room.Join(c)
	c.room = room

	session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)
	if err := session.HandlePlayerJoin(c.PlayerId, c.PlayerName); err != nil {
		c.logger.Error("failed to add player to game session", zap.Error(err))
	}

	c.logger.Info("player joined room",
		zap.String("room_id", msg.RoomID),
		zap.String("player_name", payload.PlayerName),
	)

	waitingLobbyData := session.GetWaitingLobbySnapshot()
	waitingLobbyStateMsg, err := protocol.NewMessage(
		protocol.WaitingLobbyState,
		c.room.ID,
		c.PlayerId,
		waitingLobbyData,
	)
	if err != nil {
		c.logger.Error("failed to create join broadcast", zap.Error(err))
		return
	}

	c.room.Broadcast(waitingLobbyStateMsg, c)

	// Persist to Redis
	// if c.hub.repo != nil {
	// 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	// 	defer cancel()
	// 	c.hub.repo.AddPlayerToRoom(ctx, msg.RoomID, c.PlayerId)
	// }
}

func (c *Client) handleLeave(msg *protocol.Message) {
	if c.room == nil {
		return
	}

	// Remove player from game session
	if session, ok := c.hub.gameManager.GetSession(c.room.ID); ok {
		if err := session.HandlePlayerLeave(c.PlayerId); err != nil {
			c.logger.Error("failed to remove player from game session", zap.Error(err))
		}
	}

	c.room.Leave(c)

	c.logger.Info("player left room",
		zap.String("room_id", c.room.ID),
	)

	// Persist to Redis
	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.RemovePlayerFromRoom(ctx, c.room.ID, c.PlayerId)
	}

	c.room = nil
}

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
	case "nextPhase":
		c.handleNextPhase(session)
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

	c.sendPlayerSnapshotToAll(session)

	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.SaveMessage(ctx, c.room.ID, c.ID, msg, 24*time.Hour)
	}
}

func (c *Client) handlePlantBean(session interface{}, payload map[string]any) {
	cardID, _ := payload["cardId"].(string)
	slotId, _ := payload["slotId"].(string)

	if cardID == "" || slotId == "" {
		c.sendError("invalid_params", "Missing cardId or slotId")
		return
	}

	if s, ok := session.(*game.Session); ok {
		if err := s.HandlePlantBean(c.PlayerId, cardID, slotId); err != nil {
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleTradeBean(session interface{}, payload map[string]any) {
	s, ok := session.(*game.Session)
	if !ok {
		c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	fromPlayerID, _ := payload["fromPlayerId"].(string)
	toPlayerID, _ := payload["toPlayerId"].(string)

	// cardsGiven and cardsReceived are sent as []interface{} from JSON
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
		if gameErr, ok := err.(*game.GameError); ok {
			c.sendError(gameErr.Code, gameErr.Message)
		} else {
			c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		}
	}
}

// handleCreateOffer handles the "createOffer" action payload.
func (c *Client) handleCreateOffer(session interface{}, payload map[string]any) {
	s, ok := session.(*game.Session)
	if !ok {
		c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	targetID, _ := payload["target_player_id"].(string)
	cardsOffered := parseOfferCards(payload["cards_offered"])
	cardsRequested := parseOfferCards(payload["cards_requested"])

	if _, err := s.HandleCreateOffer(c.PlayerId, targetID, cardsOffered, cardsRequested); err != nil {
		if gameErr, ok := err.(*game.GameError); ok {
			c.sendError(gameErr.Code, gameErr.Message)
		} else {
			c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		}
	}
}

// handleCounterOffer handles the "counterOffer" action payload.
func (c *Client) handleCounterOffer(session interface{}, payload map[string]any) {
	s, ok := session.(*game.Session)
	if !ok {
		c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	parentOfferID, _ := payload["parent_offer_id"].(string)
	if parentOfferID == "" {
		c.sendError("invalid_params", "Missing parent_offer_id")
		return
	}

	cardsOffered := parseOfferCards(payload["cards_offered"])
	cardsRequested := parseOfferCards(payload["cards_requested"])

	if _, err := s.HandleCounterOffer(parentOfferID, c.PlayerId, cardsOffered, cardsRequested); err != nil {
		if gameErr, ok := err.(*game.GameError); ok {
			c.sendError(gameErr.Code, gameErr.Message)
		} else {
			c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		}
	}
}

// handleRespondOffer handles the "respondOffer" action payload.
// The "action" field in the payload must be "accept", "reject", or "cancel".
func (c *Client) handleRespondOffer(session interface{}, payload map[string]any) {
	s, ok := session.(*game.Session)
	if !ok {
		c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	offerID, _ := payload["offer_id"].(string)
	action, _ := payload["action"].(string)

	if offerID == "" || action == "" {
		c.sendError("invalid_params", "Missing offer_id or action")
		return
	}

	if err := s.HandleRespondOffer(offerID, c.PlayerId, action); err != nil {
		if gameErr, ok := err.(*game.GameError); ok {
			c.sendError(gameErr.Code, gameErr.Message)
		} else {
			c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		}
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

func (c *Client) handleHarvestField(session interface{}, payload map[string]any) {
	slotId, _ := payload["slotId"].(string)

	if slotId == "" {
		c.sendError("invalid_params", "Missing slotId")
		return
	}

	if s, ok := session.(*game.Session); ok {
		if err := s.HandleHarvestField(c.PlayerId, slotId); err != nil {
			// Check if it's a GameError to send structured error
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleTurnOverBean(session interface{}) {
	if s, ok := session.(*game.Session); ok {
		if err := s.HandleTurnOverBean(c.PlayerId); err != nil {
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleDrawCards(session interface{}) {
	if s, ok := session.(*game.Session); ok {
		if err := s.HandleDrawCards(c.PlayerId); err != nil {
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}
func (c *Client) handleNextPhase(session interface{}) {
	if s, ok := session.(*game.Session); ok {
		if err := s.HandleNextPhase(c.PlayerId); err != nil {
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

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
		if gameErr, ok := err.(*game.GameError); ok {
			c.sendError(gameErr.Code, gameErr.Message)
		} else {
			c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	waitingLobbyData := session.GetWaitingLobbySnapshot()
	waitingLobbyStateMsg, err := protocol.NewMessage(
		protocol.WaitingLobbyState,
		c.room.ID,
		c.PlayerId,
		waitingLobbyData,
	)
	if err != nil {
		c.logger.Error("failed to create join broadcast", zap.Error(err))
		return
	}

	c.room.Broadcast(waitingLobbyStateMsg, c)

	// Check if the game can auto-start now that ready state changed
	started, err := session.HandleStartGame()
	if err != nil {
		c.logger.Debug("game cannot start yet", zap.Error(err))
		return
	}

	if started {
		// Broadcast "game_started" event to all clients in the room
		gameStartedMsg, err := protocol.NewMessage(
			protocol.MessageTypeBroadcast,
			c.room.ID,
			c.PlayerId,
			protocol.BroadcastPayload{
				Event: "game_started",
				Data:  map[string]any{},
			},
		)
		if err != nil {
			c.logger.Error("failed to create game_started broadcast", zap.Error(err))
			return
		}
		c.room.Broadcast(gameStartedMsg, c)

		c.sendPlayerSnapshotToAll(session)
	}
}

func (c *Client) sendError(code, message string) {
	errorMsg, err := protocol.NewMessage(
		protocol.MessageTypeError,
		"",
		c.PlayerId,
		protocol.ErrorPayload{
			Code:    code,
			Message: message,
		},
	)
	if err != nil {
		c.logger.Error("failed to create error message", zap.Error(err))
		return
	}

	data, err := errorMsg.ToJSON()
	if err != nil {
		c.logger.Error("failed to marshal error message", zap.Error(err))
		return
	}

	select {
	case c.send <- data:
	default:
		c.logger.Warn("send channel full, dropping error message")
	}
}

func (c *Client) sendGameState(roomID string, session interface{}) {
	var stateData map[string]interface{}

	if s, ok := session.(*game.Session); ok {
		stateData = s.GetFullSnapshot()
	} else {
		c.logger.Error("invalid session type")
		return
	}

	stateMsg, err := protocol.NewMessage(
		protocol.MessageTypeState,
		roomID,
		c.PlayerId,
		stateData,
	)
	if err != nil {
		c.logger.Error("failed to create state message", zap.Error(err))
		return
	}

	data, err := stateMsg.ToJSON()
	if err != nil {
		c.logger.Error("failed to marshal state message", zap.Error(err))
		return
	}

	select {
	case c.send <- data:
		c.logger.Debug("sent game state to client", zap.String("room_id", roomID))
	default:
		c.logger.Warn("send channel full, dropping state message")
	}
}

func (c *Client) handlePlayerState(msg *protocol.Message) {
	var stateData map[string]interface{}

	// Get game session
	session, ok := c.hub.gameManager.GetSession(c.room.ID)
	if !ok {
		c.sendError("session_not_found", "Game session not found")
		return
	}
	stateData = session.GetPlayerSnapshot(msg.PlayerID)

	stateMsg, err := protocol.NewMessage(
		protocol.MessageTypePlayerState,
		msg.RoomID,
		c.PlayerId,
		stateData,
	)
	if err != nil {
		c.logger.Error("failed to create state message", zap.Error(err))
		return
	}

	data, err := stateMsg.ToJSON()
	if err != nil {
		c.logger.Error("failed to marshal state message", zap.Error(err))
		return
	}

	select {
	case c.send <- data:
		c.logger.Debug("sent game state to client", zap.String("room_id", c.room.ID))
	default:
		c.logger.Warn("send channel full, dropping state message")
	}
}

// sendPlayerSnapshotToAll sends each client in the room their personalized player snapshot
func (c *Client) sendPlayerSnapshotToAll(session *game.Session) {
	for _, client := range c.room.GetClients() {
		playerSnapshot := session.GetPlayerSnapshot(client.PlayerId)

		stateMsg, err := protocol.NewMessage(
			protocol.MessageTypePlayerState,
			c.room.ID,
			client.PlayerId,
			playerSnapshot,
		)
		if err != nil {
			c.logger.Error("failed to create player state message",
				zap.Error(err),
				zap.String("target_player", client.PlayerId),
			)
			continue
		}

		data, err := stateMsg.ToJSON()
		if err != nil {
			c.logger.Error("failed to marshal player state message", zap.Error(err))
			continue
		}

		client.Send(data)
	}
}

// Send sends a message to the client
func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	case <-c.ctx.Done():
		return
	default:
		c.logger.Warn("send channel full, dropping message")
	}
}
