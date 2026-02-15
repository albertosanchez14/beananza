package websocket

import (
	"context"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

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
	// Unique identifier for this client
	ID string

	// The WebSocket connection
	conn *websocket.Conn

	// Hub that manages this client
	hub *Hub

	// Room the client is currently in
	room *Room

	// Buffered channel of outbound messages
	send chan []byte

	// Logger for this client
	logger *zap.Logger

	// Player information
	PlayerID   string
	PlayerName string

	// Context for cancellation
	ctx    context.Context
	cancel context.CancelFunc
}

// NewClient creates a new WebSocket client
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

// ReadPump pumps messages from the WebSocket connection to the hub
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
		if c.PlayerID == "" && msg.PlayerID != "" {
			c.PlayerID = msg.PlayerID
		}

		// Handle the message
		c.handleMessage(msg)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
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
			for i := 0; i < n; i++ {
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

// handleMessage processes incoming messages
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
	case protocol.MessageTypeMove:
		c.handleMove(msg)
	default:
		c.sendError("unknown_message_type", "Unknown message type")
	}
}

// handleJoin handles a join message
func (c *Client) handleJoin(msg *protocol.Message) {
	var payload protocol.JoinPayload
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid join payload")
		return
	}

	c.PlayerName = payload.PlayerName
	if c.PlayerID == "" {
		c.PlayerID = c.ID // Use client ID as player ID if not set
	}

	// Join the room
	room := c.hub.GetOrCreateRoom(msg.RoomID)
	room.Join(c)
	c.room = room

	c.logger.Info("player joined room",
		zap.String("room_id", msg.RoomID),
		zap.String("player_name", payload.PlayerName),
	)

	// Persist to Redis
	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.AddPlayerToRoom(ctx, msg.RoomID, c.PlayerID)
	}
}

// handleLeave handles a leave message
func (c *Client) handleLeave(msg *protocol.Message) {
	if c.room == nil {
		return
	}

	c.room.Leave(c)

	c.logger.Info("player left room",
		zap.String("room_id", c.room.ID),
	)

	// Persist to Redis
	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.RemovePlayerFromRoom(ctx, c.room.ID, c.PlayerID)
	}

	c.room = nil
}

// handleMove handles a move message
func (c *Client) handleMove(msg *protocol.Message) {
	if c.room == nil {
		c.sendError("not_in_room", "You must join a room first")
		return
	}

	var payload protocol.MovePayload
	if err := msg.ParsePayload(&payload); err != nil {
		c.sendError("invalid_payload", "Invalid move payload")
		return
	}

	c.logger.Debug("player move",
		zap.String("room_id", c.room.ID),
		zap.String("action", payload.Action),
	)

	// Broadcast the move to all clients in the room
	c.room.Broadcast(msg, c)

	// Persist message to Redis
	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.hub.repo.SaveMessage(ctx, c.room.ID, c.ID, msg, 24*time.Hour)
	}
}

// sendError sends an error message to the client
func (c *Client) sendError(code, message string) {
	errorMsg, err := protocol.NewMessage(
		protocol.MessageTypeError,
		"",
		c.PlayerID,
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
