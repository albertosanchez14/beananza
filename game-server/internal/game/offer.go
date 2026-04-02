package game

import (
	"fmt"
	"time"
)

type OfferStatus string

const (
	OfferStatusPending   OfferStatus = "pending"
	OfferStatusAccepted  OfferStatus = "accepted"
	OfferStatusRejected  OfferStatus = "rejected"
	OfferStatusCancelled OfferStatus = "cancelled"
	OfferStatusExpired   OfferStatus = "expired"
)

// OfferCard represents a card involved in an offer, identified by type and ID.
type OfferCard struct {
	CardType CardType `json:"card_type"`
	CardID   string   `json:"card_id"`
}

// Offer represents a trade proposal between players.
// Offers form a tree via ParentOfferID: root offers have ParentOfferID == "",
// and counteroffers point to their parent. Multiple counteroffers against the
// same parent are allowed (parallel branches).
type Offer struct {
	ID             string          `json:"id"`
	CreatorID      string          `json:"creator_id"`
	TargetID       string          `json:"target_id"`       // "" means open to any player
	ParentOfferID  string          `json:"parent_offer_id"` // "" means root offer
	CardsOffered   []OfferCard     `json:"cards_offered"`   // cards the creator puts on the table
	CardsRequested []OfferCard     `json:"cards_requested"` // cards the creator wants in return
	Status         OfferStatus     `json:"status"`
	Rejections     map[string]bool `json:"rejections,omitempty"` // per-player rejections for broadcast offers
	CreatedAt      time.Time       `json:"created_at"`
}

// newOfferID generates a unique offer ID using nanosecond timestamp.
func newOfferID() string {
	return fmt.Sprintf("offer_%d", time.Now().UnixNano())
}
