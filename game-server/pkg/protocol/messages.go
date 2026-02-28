package protocol

import (
	"encoding/json"
	"time"
)

type MessageType string

const (
	MessageTypeJoin        MessageType = "join"
	MessageTypeLeave       MessageType = "leave"
	MessageTypeReady       MessageType = "ready"
	MessageTypeAction      MessageType = "action"
	MessageTypeError       MessageType = "error"
	MessageTypeBroadcast   MessageType = "broadcast"
	MessageTypeState       MessageType = "state"
	MessageTypePlayerState MessageType = "myState"
	WaitingLobbyState      MessageType = "waitingLobbyState"
)

type Message struct {
	Type      MessageType     `json:"type"`
	RoomID    string          `json:"room_id,omitempty"`
	PlayerID  string          `json:"player_id,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

type JoinPayload struct {
	PlayerName string         `json:"player_name"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

type LeavePayload struct {
	Reason string `json:"reason,omitempty"`
}

type ReadyPayload struct {
	Ready bool `json:"ready"`
}

type ActionPayload struct {
	Action string         `json:"action"`
	Data   map[string]any `json:"data,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type BroadcastPayload struct {
	Event string         `json:"event"`
	Data  map[string]any `json:"data,omitempty"`
}

type StatePayload any

// OfferCardPayload represents a single card in an offer payload.
type OfferCardPayload struct {
	CardType string `json:"card_type"`
	CardID   string `json:"card_id"`
}

// CreateOfferPayload is the payload for the "createOffer" action.
// TargetPlayerID is optional; when empty the offer is open to all players.
type CreateOfferPayload struct {
	CardsOffered   []OfferCardPayload `json:"cards_offered"`
	CardsRequested []OfferCardPayload `json:"cards_requested"`
	TargetPlayerID string             `json:"target_player_id,omitempty"`
}

// CounterOfferPayload is the payload for the "counterOffer" action.
type CounterOfferPayload struct {
	ParentOfferID  string             `json:"parent_offer_id"`
	CardsOffered   []OfferCardPayload `json:"cards_offered"`
	CardsRequested []OfferCardPayload `json:"cards_requested"`
}

// RespondOfferPayload is the payload for the "respondOffer" action.
// Action must be one of: "accept", "reject", "cancel".
type RespondOfferPayload struct {
	OfferID string `json:"offer_id"`
	Action  string `json:"action"`
}

func NewMessage(msgType MessageType, roomID, playerID string, payload any) (*Message, error) {
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

func (m *Message) ParsePayload(dest any) error {
	if m.Payload == nil {
		return nil
	}
	return json.Unmarshal(m.Payload, dest)
}

func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

func FromJSON(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
