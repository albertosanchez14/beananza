package websocket

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"golang.org/x/time/rate"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/game"
	"github.com/yourusername/game-server/pkg/protocol"
)

const (
	writeWait        = 10 * time.Second
	pongWait         = 60 * time.Second
	pingPeriod       = (pongWait * 9) / 10
	maxMessageSize   = 8192
	defaultRateLimit = 10
	defaultRateBurst = 20
)

// Client represents a WebSocket client connection.
// It is responsible solely for I/O: reading frames from the wire, writing
// frames to the wire, and forwarding decoded messages to the dispatcher.
// All game-domain logic lives in dispatcher.go.
type Client struct {
	ID         string
	conn       *websocket.Conn
	hub        *Hub
	room       *Room
	send       chan []byte
	PlayerId   string
	PlayerName string
	Avatar     string
	logger     *zap.Logger
	ctx        context.Context
	cancel     context.CancelFunc
	limiter    *rate.Limiter
}

func NewClient(id string, conn *websocket.Conn, hub *Hub, cfg *config.Config, logger *zap.Logger) *Client {
	ctx, cancel := context.WithCancel(context.Background())

	bufSize := 256
	rateLimit := rate.Limit(defaultRateLimit)
	rateBurst := defaultRateBurst

	if cfg != nil {
		if cfg.WS.SendBufferSize > 0 {
			bufSize = cfg.WS.SendBufferSize
		}
		if cfg.WS.RateLimit > 0 {
			rateLimit = rate.Limit(cfg.WS.RateLimit)
		}
		if cfg.WS.RateBurst > 0 {
			rateBurst = cfg.WS.RateBurst
		}
	}

	return &Client{
		ID:      id,
		conn:    conn,
		hub:     hub,
		send:    make(chan []byte, bufSize),
		logger:  logger.With(zap.String("client_id", id)),
		ctx:     ctx,
		cancel:  cancel,
		limiter: rate.NewLimiter(rateLimit, rateBurst),
	}
}

// ReadPump pumps messages from the WebSocket connection to the dispatcher.
// One goroutine per client runs ReadPump.
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

		msg, err := protocol.FromJSON(messageData)
		if err != nil {
			c.logger.Error("failed to parse message", zap.Error(err))
			c.sendError("invalid_message", "Failed to parse message")
			continue
		}

		// Enforce per-client rate limit.  When a client exceeds the allowed
		// rate we drop the message and send back an error rather than
		// disconnecting immediately, giving the client a chance to slow down.
		if !c.limiter.Allow() {
			c.logger.Warn("rate limit exceeded, dropping message",
				zap.String("player_id", c.PlayerId),
				zap.String("msg_type", string(msg.Type)),
			)
			c.sendError("rate_limited", "Too many messages — slow down")
			continue
		}

		// Authenticate the message using the auth token carried in the envelope.
		// When Redis is available every message must present a valid token; the
		// server-side profile is the authoritative source for player identity.
		// In dev mode (no Redis) we fall back to trusting the client-supplied ID.
		if c.hub.repo != nil {
			if msg.AuthToken == "" {
				c.sendError("unauthorized", "Missing auth token")
				continue
			}
			authCtx, authCancel := context.WithTimeout(context.Background(), 3*time.Second)
			profile, err := c.hub.repo.GetPlayerByToken(authCtx, msg.AuthToken)
			authCancel()
			if err != nil || profile == nil {
				c.sendError("unauthorized", "Invalid or expired auth token")
				continue
			}
			// First message: bind identity from the server-side record.
			if c.PlayerId == "" {
				c.PlayerId = profile.PlayerID
				c.PlayerName = profile.PlayerName
			} else if c.PlayerId != profile.PlayerID {
				// Token belongs to a different player — reject.
				c.sendError("unauthorized", "Auth token does not match player")
				continue
			}
		} else {
			// No storage configured — trust the client-supplied player_id (dev only).
			if c.PlayerId == "" && msg.PlayerID != "" {
				c.PlayerId = msg.PlayerID
			}
		}

		c.handleMessage(msg)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection.
// One goroutine per client runs WritePump.
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
				// Hub closed the channel — signal clean close to the peer.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

			// Drain any messages already queued in the channel and send each
			// as its own frame so clients never receive concatenated JSON.
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

	switch msg.Type {
	case protocol.MessageTypeJoin:
		c.handleJoin(msg)
	case protocol.MessageTypeLeave:
		c.handleLeave()
	case protocol.MessageTypeReady:
		c.handleReady(msg)
	case protocol.MessageTypeAction:
		c.handleAction(msg)
	case protocol.MessageTypeState:
		c.sendGameState(msg)
	case protocol.MessageTypePlayerState:
		c.handlePlayerState(msg)
	case protocol.MessageTypeReconnect:
		c.handleReconnect(msg)
	default:
		c.sendError("unknown_message_type", "Unknown message type")
	}
}

// ----------------------------------------------------------------------------
// Outbound helpers
// ----------------------------------------------------------------------------

// sendError marshals a protocol error and queues it for delivery to the client.
// If the send channel is full the message is dropped and a warning is logged.
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
		c.logger.Warn("send channel full, dropping error message",
			zap.String("error_code", code),
		)
	}
}

// sendGameError is a convenience wrapper that extracts code and message from a
// *game.GameError, falling back to INTERNAL_ERROR for unexpected errors.
func (c *Client) sendGameError(err error) {
	if gameErr, ok := err.(*game.GameError); ok {
		c.sendError(gameErr.Code, gameErr.Message)
	} else {
		c.sendError("INTERNAL_ERROR", "An unexpected error occurred")
	}
}

func (c *Client) sendGameState(msg *protocol.Message) {
	session := c.hub.gameManager.GetOrCreateSession(msg.RoomID)
	stateData := session.GetFullSnapshot()

	stateMsg, err := protocol.NewMessage(
		protocol.MessageTypeState,
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
		c.logger.Debug("sent game state to client", zap.String("room_id", msg.RoomID))
	default:
		c.logger.Warn("send channel full, dropping state message",
			zap.String("room_id", msg.RoomID),
		)
	}
}

func (c *Client) handlePlayerState(msg *protocol.Message) {
	session, ok := c.hub.gameManager.GetSession(c.room.ID)
	if !ok {
		c.sendError("session_not_found", "Game session not found")
		return
	}
	if c.hub.repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := session.LoadFromStorage(ctx); err != nil {
			c.logger.Warn("failed to reload session for player state",
				zap.String("room_id", c.room.ID),
				zap.Error(err),
			)
		}
	}
	stateData := session.GetPlayerSnapshot(msg.PlayerID)

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
		c.logger.Debug("sent player state to client", zap.String("room_id", c.room.ID))
	default:
		c.logger.Warn("send channel full, dropping player state message",
			zap.String("room_id", c.room.ID),
		)
	}
}

// sendPlayerSnapshotToAll pushes each client in the room their own personalised
// myState snapshot. Called after any action that mutates game state.
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

// sendJoined sends a "joined" message to this client carrying the session token
// and current session state. It is a no-op when Redis is not configured.
func (c *Client) sendJoined(roomID, sessionState string) {
	if c.hub.repo == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	token := ""
	// Try to issue a fresh session token; failures are non-fatal.
	if newToken, err := func() (string, error) {
		t := uuid.NewString()
		return t, c.hub.repo.SaveSessionToken(ctx, t, c.PlayerId)
	}(); err == nil {
		token = newToken
	} else {
		c.logger.Warn("failed to save session token for joined message", zap.Error(err))
		return
	}

	joinedMsg, err := protocol.NewMessage(
		protocol.MessageTypeJoined,
		roomID,
		c.PlayerId,
		protocol.JoinedPayload{
			PlayerID:     c.PlayerId,
			SessionToken: token,
			SessionState: sessionState,
		},
	)
	if err != nil {
		c.logger.Error("failed to create joined message", zap.Error(err))
		return
	}
	data, err := joinedMsg.ToJSON()
	if err != nil {
		c.logger.Error("failed to marshal joined message", zap.Error(err))
		return
	}
	c.Send(data)
}

// Send queues data for delivery to the client.
// If the channel is full (slow/unresponsive client) the message is dropped.
func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	case <-c.ctx.Done():
		return
	default:
		c.logger.Warn("send channel full, dropping message",
			zap.String("player_id", c.PlayerId),
		)
	}
}
