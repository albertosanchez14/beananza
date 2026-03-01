package game

import (
	"encoding/json"
	"fmt"
	"sort"
)

type Slot struct {
	SlotId     string   `json:"slotId"`
	CardType   CardType `json:"cardName"`
	CardNumber int      `json:"cardQuantity"`
	CardIds    []string `json:"cardIds"`
}

type Field struct {
	FieldId     string           `json:"fieldID"`
	Slots       map[string]*Slot `json:"-"`
	SlotsNumber int              `json:"slotsNumber"`
}

func NewField(fieldId string, slotsNumber int) *Field {
	slots := make(map[string]*Slot, slotsNumber)
	for i := range slotsNumber {
		slotId := generateSlotID(fieldId, i)
		slots[slotId] = &Slot{
			SlotId:     slotId,
			CardType:   "",
			CardNumber: 0,
			CardIds:    []string{},
		}
	}
	return &Field{
		FieldId:     fieldId,
		Slots:       slots,
		SlotsNumber: slotsNumber,
	}
}

// MarshalJSON serializes Field with Slots as a JSON array to preserve client compatibility.
func (f *Field) MarshalJSON() ([]byte, error) {
	slots := make([]*Slot, 0, len(f.Slots))
	for _, s := range f.Slots {
		slots = append(slots, s)
	}
	sort.Slice(slots, func(i, j int) bool {
		return slots[i].SlotId < slots[j].SlotId
	})
	return json.Marshal(&struct {
		FieldId     string  `json:"fieldID"`
		Slots       []*Slot `json:"slots"`
		SlotsNumber int     `json:"slotsNumber"`
	}{
		FieldId:     f.FieldId,
		Slots:       slots,
		SlotsNumber: f.SlotsNumber,
	})
}

// UnmarshalJSON deserializes Field from a JSON array of slots (Redis persistence).
func (f *Field) UnmarshalJSON(data []byte) error {
	aux := &struct {
		FieldId     string  `json:"fieldID"`
		Slots       []*Slot `json:"slots"`
		SlotsNumber int     `json:"slotsNumber"`
	}{}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	f.FieldId = aux.FieldId
	f.SlotsNumber = aux.SlotsNumber
	f.Slots = make(map[string]*Slot, len(aux.Slots))
	for _, s := range aux.Slots {
		f.Slots[s.SlotId] = s
	}
	return nil
}

func (f *Field) GetSlotFromId(slotId string) (*Slot, error) {
	slot, ok := f.Slots[slotId]
	if !ok {
		return nil, NewSlotNotFoundError(slotId)
	}
	return slot, nil
}

// AddToSlot adds a card to a slot by its ID.
// Returns an error if the slot doesn't exist, has a type mismatch,
// or if another slot already holds the same card type.
func (f *Field) AddToSlot(slotId string, cardType CardType, cardId string) error {
	// RULE: If another slot already holds this cardType, the player must plant there
	for _, s := range f.Slots {
		if s.CardType == cardType && s.SlotId != slotId {
			return NewSlotAlreadyExistsForTypeError(cardType, s.SlotId)
		}
	}

	slot, err := f.GetSlotFromId(slotId)
	if err != nil {
		return err
	}

	if slot.CardType == "" {
		slot.CardType = cardType
	} else if slot.CardType != cardType {
		return NewCardTypeMismatchError(slot.CardType, cardType)
	}

	slot.CardIds = append(slot.CardIds, cardId)
	slot.CardNumber += 1

	return nil
}

// RemoveFromSlot clears the content of a slot by its ID.
func (f *Field) RemoveFromSlot(slotId string) error {
	slot, err := f.GetSlotFromId(slotId)
	if err != nil {
		return err
	}

	slot.CardNumber = 0
	slot.CardType = ""
	slot.CardIds = []string{}
	return nil
}

// CanHarvestSlot checks whether a slot of a field can be harvested.
// RULE: If there is only one bean card in one of your slots, you
// cannot harvest it as long as you have another slot
// containing more than one bean card.
func (f *Field) CanHarvestSlot(slotId string) bool {
	target, ok := f.Slots[slotId]
	if !ok || target.CardNumber == 0 {
		return false
	}

	// Slots with more than 1 card can always be harvested
	if target.CardNumber > 1 {
		return true
	}

	// Target has exactly 1 card: only harvestable if no other slot has more than 1
	for id, s := range f.Slots {
		if id != slotId && s.CardNumber > 1 {
			return false
		}
	}
	return true
}

func (f *Field) IsEmpty() bool {
	return len(f.Slots) == 0
}

func (f *Field) IsFull() bool {
	return len(f.Slots) >= f.SlotsNumber
}

func generateSlotID(fieldID string, slotIndex int) string {
	return fieldID + "-slot-" + fmt.Sprintf("%d", slotIndex)
}
