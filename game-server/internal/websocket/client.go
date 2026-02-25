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
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
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

		// Handle the message
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

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for range n {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
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

	switch msg.Type {
	case protocol.MessageTypeJoin:
		c.handleJoin(msg)
	case protocol.MessageTypeLeave:
		c.handleLeave(msg)
	case protocol.MessageTypeAction:
		c.handleAction(msg)
		c.handlePlayerState(msg)
	case protocol.MessageTypeState:
		session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)
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

	var payload map[string]interface{}
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid action payload")
		return
	}

	// Get action type
	actionType, ok := payload["type"].(string)
	if !ok {
		c.sendError("invalid_action", "Action type missing")
		return
	}

	// Get game session
	session, ok := c.hub.gameManager.GetSession(c.room.ID)
	if !ok {
		c.sendError("session_not_found", "Game session not found")
		return
	}

	// Handle different action types
	switch actionType {
	case "plantBean":
		c.handlePlantBean(session, payload)
	case "tradeBean":
		c.handleTradeBean(session, payload)
	case "harvestField":
		c.handleHarvestField(session, payload)
	case "turnOverBean":
		c.handleTurnOverBean(session, payload)
	case "drawCards":
		c.handleDrawCards(session, payload)
	case "nextPhase":
		c.handleNextPhase(session, payload)
	default:
		c.sendError("unknown_action", "Unknown action type")
		return
	}

	c.logger.Debug("player action",
		zap.String("room_id", c.room.ID),
		zap.String("action", actionType),
	)

	// Broadcast action to all clients in room
	c.room.Broadcast(msg, c)

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
			// Check if it's a GameError to send structured error
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleTradeBean(session interface{}, payload map[string]any) {
	cardsReceived, _ := payload["cardsReceived"].([]string)
	cardsGiven, _ := payload["cardsGiven"].([]string)
	toPlayerId, _ := payload["toPlayerId"].(string)

	if toPlayerId == "" {
		c.sendError("invalid_params", "Missing cardId or toPlayerId")
		return
	}

	if s, ok := session.(*game.Session); ok {
		if err := s.HandleTradeBean(c.PlayerId, toPlayerId, cardsReceived, cardsGiven); err != nil {
			// Check if it's a GameError to send structured error
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
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

func (c *Client) handleTurnOverBean(session interface{}, payload map[string]any) {
	if s, ok := session.(*game.Session); ok {
		if err := s.HandleTurnOverBean(c.PlayerId); err != nil {
			// Check if it's a GameError to send structured error
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleDrawCards(session interface{}, payload map[string]any) {
	if s, ok := session.(*game.Session); ok {
		if err := s.HandleDrawCards(c.PlayerId); err != nil {
			// Check if it's a GameError to send structured error
			if gameErr, ok := err.(*game.GameError); ok {
				c.sendError(gameErr.Code, gameErr.Message)
			} else {
				c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
			}
		}
	}
}

func (c *Client) handleNextPhase(session interface{}, payload map[string]any) {
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
