package game

import (
	"fmt"
)

type Slot struct {
	SlotId     string   `json:"slotId"`
	CardType   CardType `json:"cardName"`
	CardNumber int      `json:"cardQuantity"`
	CardIds    []string `json:"cardIds"`
}

type Field struct {
	FieldId     string  `json:"fieldID"`
	Slots       []*Slot `json:"slots"`
	SlotsNumber int     `json:"slotsNumber"`
}

func NewField(fieldId string, slotsNumber int) *Field {
	slots := make([]*Slot, 0, slotsNumber)
	for i := range slotsNumber {
		slots = append(slots, &Slot{
			SlotId:     generateSlotID(fieldId, i),
			CardType:   "",
			CardNumber: 0,
		})
	}
	return &Field{
		FieldId:     fieldId,
		Slots:       slots,
		SlotsNumber: slotsNumber,
	}
}

func (f *Field) GetSlotFromId(slotId string) (*Slot, error) {
	for _, slot := range f.Slots {
		if slot.SlotId == slotId {
			return slot, nil
		}
	}
	return nil, NewSlotNotFoundError(slotId)
}

// AddToSlot adds a card to a slot by its ID
// If the slot doesn't exist, it returns an error
func (f *Field) AddToSlot(slotId string, cardType CardType, cardId string) error {
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

// RemoveFromSlot removes the content of a slot by its ID from the field
func (f *Field) RemoveFromSlot(slotId string) error {
	slot, err := f.GetSlotFromId(slotId)
	if err != nil {
		return err
	}

	slot.CardNumber = 0
	slot.CardType = ""
	return nil
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
