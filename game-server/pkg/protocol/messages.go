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
	MessageTypeReconnect   MessageType = "reconnect"
	// MessageTypeJoined is sent by the server after a successful join, carrying
	// the session token the client should store for reconnection.
	MessageTypeJoined MessageType = "joined"
)

// BroadcastEvent names used in BroadcastPayload.Event.
// Using constants prevents typos and makes cross-file references greppable.
const (
	EventPlayerJoined = "player_joined"
	EventPlayerLeft   = "player_left"
	EventPlayerReady  = "player_ready"
	EventGameStarted  = "game_started"
	EventStateUpdated = "state_updated"
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

// JoinedPayload is sent by the server back to a client after a successful join,
// carrying the session token the client must present to reconnect.
type JoinedPayload struct {
	PlayerID     string `json:"player_id"`
	SessionToken string `json:"session_token"`
}

// ReconnectPayload is sent by a client to resume a game session after a
// disconnect.  SessionToken was issued by the server during the original join.
type ReconnectPayload struct {
	SessionToken string `json:"session_token"`
	PlayerName   string `json:"player_name,omitempty"`
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
