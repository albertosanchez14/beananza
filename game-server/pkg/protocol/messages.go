package protocol

import (
	"encoding/json"
	"time"
)

// MessageType represents the type of WebSocket message
type MessageType string

const (
	// MessageTypeJoin is sent when a player joins a room
	MessageTypeJoin MessageType = "join"
	// MessageTypeLeave is sent when a player leaves a room
	MessageTypeLeave MessageType = "leave"
	// MessageTypeMove is sent when a player makes a move
	MessageTypeMove MessageType = "move"
	// MessageTypeError is sent when an error occurs
	MessageTypeError MessageType = "error"
	// MessageTypeBroadcast is sent for general broadcasts
	MessageTypeBroadcast MessageType = "broadcast"
)

// Message represents the base WebSocket message structure
type Message struct {
	Type      MessageType     `json:"type"`
	RoomID    string          `json:"room_id,omitempty"`
	PlayerID  string          `json:"player_id,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// JoinPayload represents the payload for a join message
type JoinPayload struct {
	PlayerName string                 `json:"player_name"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// LeavePayload represents the payload for a leave message
type LeavePayload struct {
	Reason string `json:"reason,omitempty"`
}

// MovePayload represents the payload for a move message
type MovePayload struct {
	Action string                 `json:"action"`
	Data   map[string]interface{} `json:"data,omitempty"`
}

// ErrorPayload represents the payload for an error message
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// BroadcastPayload represents the payload for a broadcast message
type BroadcastPayload struct {
	Event string                 `json:"event"`
	Data  map[string]interface{} `json:"data,omitempty"`
}

// NewMessage creates a new message with the current timestamp
func NewMessage(msgType MessageType, roomID, playerID string, payload interface{}) (*Message, error) {
	var rawPayload json.RawMessage
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		rawPayload = data
	}

	return &Message{
		Type:      msgType,
		RoomID:    roomID,
		PlayerID:  playerID,
		Payload:   rawPayload,
		Timestamp: time.Now(),
	}, nil
}

// ParsePayload parses the message payload into the given destination
func (m *Message) ParsePayload(dest interface{}) error {
	if m.Payload == nil {
		return nil
	}
	return json.Unmarshal(m.Payload, dest)
}

// ToJSON converts the message to JSON bytes
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// FromJSON creates a message from JSON bytes
func FromJSON(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
