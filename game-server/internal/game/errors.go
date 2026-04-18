package game

import "fmt"

type GameError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

func (e *GameError) Error() string {
	if len(e.Details) == 0 {
		return fmt.Sprintf("%s: %s", e.Code, e.Message)
	}
	return fmt.Sprintf("%s: %s (details: %v)", e.Code, e.Message, e.Details)
}

const (
	ErrCodePlayerNotFound           = "PLAYER_NOT_FOUND"
	ErrCodeNotPlayerTurn            = "NOT_PLAYER_TURN"
	ErrCodeInvalidPhase             = "INVALID_PHASE"
	ErrCodeMaxBeansPlanted          = "MAX_BEANS_PLANTED"
	ErrCodeCardNotFound             = "CARD_NOT_FOUND"
	ErrCodeCardNotInHand            = "CARD_NOT_IN_HAND"
	ErrCodeCardNotInCenter          = "CARD_NOT_IN_CENTER"
	ErrCodeDeckEmpty                = "DECK_EMPTY"
	ErrCodeInsufficientCards        = "INSUFFICIENT_CARDS"
	ErrCodeFieldEmpty               = "FIELD_EMPTY"
	ErrCodeMinBeansRequired         = "MIN_BEANS_REQUIRED"
	ErrCodeCenterCardsRemain        = "CENTER_CARDS_REMAINING"
	ErrCodeCannotChangeTurn         = "CANNOT_CHANGE_TURN"
	ErrCodeSlotNotFound             = "SLOT_NOT_FOUND"
	ErrCodeCardTypeMismatch         = "CARD_TYPE_MISMATCH"
	ErrCodeInvalidAction            = "INVALID_ACTION"
	ErrCodeNotInWaitingPhase        = "NOT_IN_WAITING_PHASE"
	ErrCodeNotEnoughPlayers         = "NOT_ENOUGH_PLAYERS"
	ErrCodeNotAllPlayersReady       = "NOT_ALL_PLAYERS_READY"
	ErrCodeWaitingLobbyFull         = "WAITING_ROOM_FULL"
	ErrCodeOfferNotFound            = "OFFER_NOT_FOUND"
	ErrCodeCardNotInOrder           = "CARD_NOT_IN_ORDER"
	ErrCodeSlotAlreadyExistsForType = "SLOT_ALREADY_EXISTS_FOR_TYPE"
	ErrCodeCannotHarvestSlot        = "CANNOT_HARVEST_SLOT"
	ErrCodeGameAlreadyStarted       = "GAME_ALREADY_STARTED"
)

// NewPlayerNotFoundError creates an error when a player is not found
func NewPlayerNotFoundError(playerID string) *GameError {
	return &GameError{
		Code:    ErrCodePlayerNotFound,
		Message: "player not found",
		Details: map[string]any{
			"player_id": playerID,
		},
	}
}

// NewNotPlayerTurnError creates an error when it's not the player's turn
func NewNotPlayerTurnError(playerID, currentPlayerID string) *GameError {
	return &GameError{
		Code:    ErrCodeNotPlayerTurn,
		Message: "not player's turn",
		Details: map[string]any{
			"player_id":         playerID,
			"current_player_id": currentPlayerID,
		},
	}
}

// NewInvalidPhaseError creates an error when an action is invalid in the current phase
func NewInvalidPhaseError(currentPhase PhaseType) *GameError {
	return &GameError{
		Code:    ErrCodeInvalidPhase,
		Message: "action not valid in current phase",
		Details: map[string]any{
			"current_phase": string(currentPhase),
		},
	}
}

// NewMaxBeansPlantedError creates an error when max beans have been planted
func NewMaxBeansPlantedError(playerID string, beansPlanted int) *GameError {
	return &GameError{
		Code:    ErrCodeMaxBeansPlanted,
		Message: "player has already planted maximum beans this turn",
		Details: map[string]any{
			"player_id":     playerID,
			"beans_planted": beansPlanted,
		},
	}
}

// NewCardNotInHandError creates an error when a card is not found in player's hand
func NewCardNotInHandError(playerID, cardID string) *GameError {
	return &GameError{
		Code:    ErrCodeCardNotInHand,
		Message: "card not found in player's hand",
		Details: map[string]any{
			"player_id": playerID,
			"card_id":   cardID,
		},
	}
}

// NewCardNotInCenterError creates an error when a card is not found in center
func NewCardNotInCenterError(cardID string) *GameError {
	return &GameError{
		Code:    ErrCodeCardNotInCenter,
		Message: "card not found in center",
		Details: map[string]any{
			"card_id": cardID,
		},
	}
}

// NewInsufficientCardsError creates an error when the combined draw+discard pile
// has fewer cards than needed for a full draw.
func NewInsufficientCardsError(available, needed int) *GameError {
	return &GameError{
		Code:    ErrCodeInsufficientCards,
		Message: "not enough cards remaining to draw",
		Details: map[string]any{
			"available": available,
			"needed":    needed,
		},
	}
}

// NewDeckEmptyError creates an error when the deck is empty
func NewDeckEmptyError() *GameError {
	return &GameError{
		Code:    ErrCodeDeckEmpty,
		Message: "deck is empty",
		Details: map[string]any{},
	}
}

// NewFieldEmptyError creates an error when trying to harvest an empty field
func NewFieldEmptyError(playerID string) *GameError {
	return &GameError{
		Code:    ErrCodeFieldEmpty,
		Message: "field is empty, nothing to harvest",
		Details: map[string]any{
			"player_id": playerID,
		},
	}
}

// NewMinBeansRequiredError creates an error when minimum beans requirement not met
func NewMinBeansRequiredError(playerID string, beansPlanted int) *GameError {
	return &GameError{
		Code:    ErrCodeMinBeansRequired,
		Message: "must plant at least 1 bean before changing phase",
		Details: map[string]any{
			"player_id":     playerID,
			"beans_planted": beansPlanted,
		},
	}
}

// NewCenterCardsRemainingError creates an error when center cards must be cleared
func NewCenterCardsRemainingError(centerCardsCount int) *GameError {
	return &GameError{
		Code:    ErrCodeCenterCardsRemain,
		Message: "center cards must be planted or traded before changing phase",
		Details: map[string]any{
			"center_cards_count": centerCardsCount,
		},
	}
}

func NewNotDrawnedCardsError() *GameError {
	// NewNotDrawnedCardsError creates an error when center cards must be cleared
	return &GameError{
		Code:    ErrCodeCannotChangeTurn,
		Message: "Need to draw all cards from the middle before changing turn",
	}
}

// NewSlotNotFoundError creates an error when a slot is not found
func NewSlotNotFoundError(slotID string) *GameError {
	return &GameError{
		Code:    ErrCodeSlotNotFound,
		Message: "slot not found",
		Details: map[string]any{
			"slot_id": slotID,
		},
	}
}

// NewCardTypeMismatchError creates an error when card types don't match in a slot
func NewCardTypeMismatchError(slotCardType, attemptedCardType CardType) *GameError {
	return &GameError{
		Code:    ErrCodeCardTypeMismatch,
		Message: "card type mismatch",
		Details: map[string]any{
			"slot_card_type":      string(slotCardType),
			"attempted_card_type": string(attemptedCardType),
		},
	}
}

// NewInvalidActionError creates an error when doing an action not valid
func NewInvalidActionError(msg string) *GameError {
	return &GameError{
		Code:    ErrCodeInvalidAction,
		Message: "invalid action",
		Details: map[string]any{
			"action": msg,
		},
	}
}

// NewNotInWaitingPhaseError creates an error when trying to set ready outside waiting phase
func NewNotInWaitingPhaseError(currentPhase PhaseType) *GameError {
	return &GameError{
		Code:    ErrCodeNotInWaitingPhase,
		Message: "cannot set ready state outside of waiting phase",
		Details: map[string]any{
			"current_phase": string(currentPhase),
		},
	}
}

// NewNotEnoughPlayersError creates an error when not enough players to start
func NewNotEnoughPlayersError(currentCount, minRequired int) *GameError {
	return &GameError{
		Code:    ErrCodeNotEnoughPlayers,
		Message: "not enough players to start game",
		Details: map[string]any{
			"current_count": currentCount,
			"min_required":  minRequired,
		},
	}
}

// NewNotAllPlayersReadyError creates an error when not all players are ready
func NewNotAllPlayersReadyError(readyCount, totalCount int) *GameError {
	return &GameError{
		Code:    ErrCodeNotAllPlayersReady,
		Message: "not all players are ready",
		Details: map[string]any{
			"ready_count": readyCount,
			"total_count": totalCount,
		},
	}
}

func NewWaitingLobbyFullError(maxPlayers int) *GameError {
	return &GameError{
		Code:    ErrCodeWaitingLobbyFull,
		Message: "waiting room is full",
		Details: map[string]any{
			"max_number_players": maxPlayers,
		},
	}
}

// NewOfferNotFoundError creates an error when an offer is not found
func NewOfferNotFoundError(offerID string) *GameError {
	return &GameError{
		Code:    ErrCodeOfferNotFound,
		Message: "offer not found",
		Details: map[string]any{
			"offer_id": offerID,
		},
	}
}

// NewCardNotInOrderError creates an error when a player tries to plant a card that is not first in hand
func NewCardNotInOrderError(playerID, cardID string) *GameError {
	return &GameError{
		Code:    ErrCodeCardNotInOrder,
		Message: "cards must be planted in order; only the first card in hand can be planted",
		Details: map[string]any{
			"player_id": playerID,
			"card_id":   cardID,
		},
	}
}

// NewSlotAlreadyExistsForTypeError creates an error when a slot already exists for the given card type
func NewSlotAlreadyExistsForTypeError(cardType CardType, existingSlotId string) *GameError {
	return &GameError{
		Code:    ErrCodeSlotAlreadyExistsForType,
		Message: "a slot already exists for this card type; plant there instead",
		Details: map[string]any{
			"card_type":        string(cardType),
			"existing_slot_id": existingSlotId,
		},
	}
}

// NewCannotHarvestSlotError creates an error when a slot cannot be harvested due to game rules
func NewCannotHarvestSlotError(slotId string) *GameError {
	return &GameError{
		Code:    ErrCodeCannotHarvestSlot,
		Message: "cannot harvest this slot: it has only 1 card while another slot has more than 1",
		Details: map[string]any{
			"slot_id": slotId,
		},
	}
}

// NewGameAlreadyStartedError creates an error when a player tries to join a game already in progress
func NewGameAlreadyStartedError() *GameError {
	return &GameError{
		Code:    ErrCodeGameAlreadyStarted,
		Message: "cannot join: game is already in progress",
	}
}
