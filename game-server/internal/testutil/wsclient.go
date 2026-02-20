package testutil

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/yourusername/game-server/pkg/protocol"
)

// WSTestClient is a WebSocket test client for testing
type WSTestClient struct {
	conn     *websocket.Conn
	url      string
	received chan *protocol.Message
	errors   chan error
	done     chan struct{}
	t        *testing.T
	mu       sync.Mutex
	closed   bool
}

// NewWSTestClient creates a new WebSocket test client
func NewWSTestClient(t *testing.T) *WSTestClient {
	return &WSTestClient{
		received: make(chan *protocol.Message, 100),
		errors:   make(chan error, 10),
		done:     make(chan struct{}),
		t:        t,
	}
}

// Connect establishes a WebSocket connection to the given URL
func (c *WSTestClient) Connect(url string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		return fmt.Errorf("already connected")
	}

	// Convert http:// to ws://
	wsURL := "ws" + url[4:] + "/ws"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	c.conn = conn
	c.url = wsURL

	// Start reading messages in background
	go c.readPump()

	return nil
}

// readPump reads messages from the WebSocket connection
func (c *WSTestClient) readPump() {
	defer func() {
		close(c.received)
		close(c.errors)
		close(c.done)
	}()

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.errors <- err
			}
			return
		}

		msg, err := protocol.FromJSON(data)
		if err != nil {
			c.errors <- fmt.Errorf("failed to parse message: %w", err)
			continue
		}

		c.received <- msg
	}
}

// SendMessage sends a message to the WebSocket server
func (c *WSTestClient) SendMessage(msg *protocol.Message) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("not connected")
	}

	data, err := msg.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	return nil
}

// ReceiveMessage waits for and returns the next received message
func (c *WSTestClient) ReceiveMessage(timeout time.Duration) (*protocol.Message, error) {
	select {
	case msg, ok := <-c.received:
		if !ok {
			return nil, fmt.Errorf("connection closed")
		}
		return msg, nil
	case err := <-c.errors:
		return nil, err
	case <-time.After(timeout):
		return nil, fmt.Errorf("timeout waiting for message")
	}
}

// ExpectMessage waits for a message of the specified type
func (c *WSTestClient) ExpectMessage(timeout time.Duration, msgType protocol.MessageType) (*protocol.Message, error) {
	deadline := time.Now().Add(timeout)

	for {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return nil, fmt.Errorf("timeout waiting for message type %s", msgType)
		}

		msg, err := c.ReceiveMessage(remaining)
		if err != nil {
			return nil, err
		}

		if msg.Type == msgType {
			return msg, nil
		}

		// Put it back for other consumers (simplified - in reality we'd buffer all)
		// For now, we just continue looking
	}
}

// ExpectError waits for an error message with the specified error code
func (c *WSTestClient) ExpectError(timeout time.Duration, errorCode string) error {
	msg, err := c.ExpectMessage(timeout, protocol.MessageTypeError)
	if err != nil {
		return err
	}

	var errPayload protocol.ErrorPayload
	if err := msg.ParsePayload(&errPayload); err != nil {
		return fmt.Errorf("failed to parse error payload: %w", err)
	}

	if errPayload.Code != errorCode {
		return fmt.Errorf("expected error code %s, got %s", errorCode, errPayload.Code)
	}

	return nil
}

// WaitForMessages waits for the specified number of messages
func (c *WSTestClient) WaitForMessages(count int, timeout time.Duration) ([]*protocol.Message, error) {
	messages := make([]*protocol.Message, 0, count)
	deadline := time.Now().Add(timeout)

	for i := 0; i < count; i++ {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return messages, fmt.Errorf("timeout: received %d/%d messages", len(messages), count)
		}

		msg, err := c.ReceiveMessage(remaining)
		if err != nil {
			return messages, fmt.Errorf("error receiving message %d/%d: %w", i+1, count, err)
		}

		messages = append(messages, msg)
	}

	return messages, nil
}

// DrainMessages reads all pending messages without blocking
func (c *WSTestClient) DrainMessages() []*protocol.Message {
	messages := make([]*protocol.Message, 0)

	for {
		select {
		case msg, ok := <-c.received:
			if !ok {
				return messages
			}
			messages = append(messages, msg)
		default:
			return messages
		}
	}
}

// Close closes the WebSocket connection
func (c *WSTestClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}

	c.closed = true

	if c.conn != nil {
		// Send close message
		err := c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		if err != nil {
			// Ignore error on close
		}

		// Close the connection
		if err := c.conn.Close(); err != nil {
			return err
		}
	}

	// Wait for readPump to finish
	select {
	case <-c.done:
	case <-time.After(1 * time.Second):
		c.t.Log("warning: readPump didn't finish in time")
	}

	return nil
}

// IsConnected returns whether the client is connected
func (c *WSTestClient) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn != nil && !c.closed
}

// GetURL returns the WebSocket URL
func (c *WSTestClient) GetURL() string {
	return c.url
}
