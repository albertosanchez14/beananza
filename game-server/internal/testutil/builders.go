package testutil

import (
	"time"

	"github.com/yourusername/game-server/pkg/protocol"
)

// MessageBuilder provides a fluent API for building test messages
type MessageBuilder struct {
	msgType  protocol.MessageType
	roomID   string
	playerID string
	payload  map[string]interface{}
}

// NewMessageBuilder creates a new message builder
func NewMessageBuilder() *MessageBuilder {
	return &MessageBuilder{
		payload: make(map[string]interface{}),
	}
}

// Join creates a join message
func (b *MessageBuilder) Join(roomID string) *MessageBuilder {
	b.msgType = protocol.MessageTypeJoin
	b.roomID = roomID
	return b
}

// Leave creates a leave message
func (b *MessageBuilder) Leave(roomID string) *MessageBuilder {
	b.msgType = protocol.MessageTypeLeave
	b.roomID = roomID
	return b
}

// Action creates an action message
func (b *MessageBuilder) Action(roomID, action string) *MessageBuilder {
	b.msgType = protocol.MessageTypeAction
	b.roomID = roomID
	b.payload["action"] = action
	if b.payload["data"] == nil {
		b.payload["data"] = make(map[string]interface{})
	}
	return b
}

// State creates a state request message
func (b *MessageBuilder) State(roomID string) *MessageBuilder {
	b.msgType = protocol.MessageTypeState
	b.roomID = roomID
	return b
}

// WithPlayerName sets the player name for join messages
func (b *MessageBuilder) WithPlayerName(name string) *MessageBuilder {
	b.payload["player_name"] = name
	return b
}

// WithPlayerID sets the player ID
func (b *MessageBuilder) WithPlayerID(playerID string) *MessageBuilder {
	b.playerID = playerID
	return b
}

// WithMetadata adds metadata to join messages
func (b *MessageBuilder) WithMetadata(metadata map[string]interface{}) *MessageBuilder {
	b.payload["metadata"] = metadata
	return b
}

// WithData adds data to the message (for actions)
func (b *MessageBuilder) WithData(key string, value interface{}) *MessageBuilder {
	if b.msgType == protocol.MessageTypeAction {
		if data, ok := b.payload["data"].(map[string]interface{}); ok {
			data[key] = value
		} else {
			data := make(map[string]interface{})
			data[key] = value
			b.payload["data"] = data
		}
	} else {
		b.payload[key] = value
	}
	return b
}

// WithReason adds a reason to leave messages
func (b *MessageBuilder) WithReason(reason string) *MessageBuilder {
	b.payload["reason"] = reason
	return b
}

// Build constructs the final message
func (b *MessageBuilder) Build() *protocol.Message {
	var payload interface{}

	switch b.msgType {
	case protocol.MessageTypeJoin:
		joinPayload := protocol.JoinPayload{
			PlayerName: b.getStringPayload("player_name"),
		}
		if metadata, ok := b.payload["metadata"].(map[string]interface{}); ok {
			joinPayload.Metadata = metadata
		}
		payload = joinPayload

	case protocol.MessageTypeLeave:
		leavePayload := protocol.LeavePayload{
			Reason: b.getStringPayload("reason"),
		}
		payload = leavePayload

	case protocol.MessageTypeAction:
		actionPayload := protocol.ActionPayload{
			Action: b.getStringPayload("action"),
		}
		if data, ok := b.payload["data"].(map[string]interface{}); ok {
			actionPayload.Data = data
		}
		payload = actionPayload

	case protocol.MessageTypeState:
		// State request has no payload
		payload = nil

	default:
		// Generic payload
		if len(b.payload) > 0 {
			payload = b.payload
		}
	}

	msg, _ := protocol.NewMessage(b.msgType, b.roomID, b.playerID, payload)
	return msg
}

// getStringPayload is a helper to get string values from payload
func (b *MessageBuilder) getStringPayload(key string) string {
	if val, ok := b.payload[key].(string); ok {
		return val
	}
	return ""
}

// BuildRaw constructs a message without type-specific payload wrapping
func (b *MessageBuilder) BuildRaw() *protocol.Message {
	var payload interface{}
	if len(b.payload) > 0 {
		payload = b.payload
	}
	msg, _ := protocol.NewMessage(b.msgType, b.roomID, b.playerID, payload)
	return msg
}

// Helper functions for common message patterns

// JoinMessage creates a simple join message
func JoinMessage(roomID, playerName string) *protocol.Message {
	return NewMessageBuilder().
		Join(roomID).
		WithPlayerName(playerName).
		Build()
}

// LeaveMessage creates a simple leave message
func LeaveMessage(roomID string) *protocol.Message {
	return NewMessageBuilder().
		Leave(roomID).
		Build()
}

// StateMessage creates a simple state request message
func StateMessage(roomID string) *protocol.Message {
	return NewMessageBuilder().
		State(roomID).
		Build()
}

// ActionMessage creates a simple action message
func ActionMessage(roomID, playerID, action string, data map[string]interface{}) *protocol.Message {
	builder := NewMessageBuilder().
		Action(roomID, action).
		WithPlayerID(playerID)

	for k, v := range data {
		builder.WithData(k, v)
	}

	return builder.Build()
}

// PlantBeanMessage creates a plantBean action message
func PlantBeanMessage(roomID, playerID, cardID, fieldID string) *protocol.Message {
	return NewMessageBuilder().
		Action(roomID, "plantBean").
		WithPlayerID(playerID).
		WithData("cardId", cardID).
		WithData("fieldId", fieldID).
		Build()
}

// HarvestFieldMessage creates a harvestField action message
func HarvestFieldMessage(roomID, playerID, fieldID string) *protocol.Message {
	return NewMessageBuilder().
		Action(roomID, "harvestField").
		WithPlayerID(playerID).
		WithData("fieldId", fieldID).
		Build()
}

// TradeBeanMessage creates a tradeBean action message
func TradeBeanMessage(roomID, playerID, fromPlayerID, toPlayerID, cardID string) *protocol.Message {
	return NewMessageBuilder().
		Action(roomID, "tradeBean").
		WithPlayerID(playerID).
		WithData("fromPlayerId", fromPlayerID).
		WithData("toPlayerId", toPlayerID).
		WithData("cardId", cardID).
		Build()
}

// TurnOverBeanMessage creates a turnOverBean action message
func TurnOverBeanMessage(roomID, playerID string) *protocol.Message {
	return NewMessageBuilder().
		Action(roomID, "turnOverBean").
		WithPlayerID(playerID).
		Build()
}

// InvalidMessage creates an invalid message for error testing
func InvalidMessage() []byte {
	return []byte(`{"type": "invalid", "invalid_json"}`)
}

// MalformedMessage creates a malformed JSON message
func MalformedMessage() []byte {
	return []byte(`{this is not valid json}`)
}

// OversizedMessage creates a message that exceeds size limits
func OversizedMessage(size int) []byte {
	data := make([]byte, size)
	for i := range data {
		data[i] = 'A'
	}
	return data
}

// MessageWithType creates a message with a custom type (for testing unknown types)
func MessageWithType(msgType string, roomID string) *protocol.Message {
	return &protocol.Message{
		Type:      protocol.MessageType(msgType),
		RoomID:    roomID,
		Timestamp: time.Now(),
	}
}
