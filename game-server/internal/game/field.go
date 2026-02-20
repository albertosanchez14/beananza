package game

import "fmt"

type Slot struct {
	SlotID     string   `json:"slotId"`
	CardType   CardType `json:"cardName"`
	CardNumber int      `json:"cardQuantity"`
}

type Field struct {
	FieldID  string  `json:"fieldID"`
	Slots    []*Slot `json:"slots"`
	MaxSlots int     `json:"maxSlots"`
	MinSlots int     `json:"minSlots"`
}

func NewField(fieldID string, maxSlots int) *Field {
	return &Field{
		FieldID:  fieldID,
		Slots:    make([]*Slot, 0, maxSlots),
		MaxSlots: maxSlots,
	}
}

func (f *Field) GetSlot(index int) (*Slot, bool) {
	if index < 0 || index >= len(f.Slots) {
		return nil, false
	}
	return f.Slots[index], true
}

func (f *Field) AddCardToSlot(index int) bool {
	if slot, ok := f.GetSlot(index); ok {
		slot.CardNumber++
		return true
	}
	return false
}

// AddSlot adds a new slot to the field if there's space
func (f *Field) AddSlot(cardType CardType) bool {
	if len(f.Slots) >= f.MaxSlots {
		return false // field is full
	}

	slotID := generateSlotID(f.FieldID, len(f.Slots))
	slot := &Slot{
		SlotID:     slotID,
		CardType:   cardType,
		CardNumber: 1,
	}

	f.Slots = append(f.Slots, slot)
	return true
}

// RemoveSlot removes a slot from the field at the given index
func (f *Field) RemoveSlot(index int) bool {
	if index < 0 || index >= len(f.Slots) {
		return false
	}

	// Remove the slot by re-slicing
	f.Slots = append(f.Slots[:index], f.Slots[index+1:]...)
	return true
}

func (f *Field) SellSlot(index int) bool {
	if slot, ok := f.GetSlot(index); ok {
		slot.CardNumber = 0
		// TODO: Logic for coins
		return true
	}
	return false
}

func (f *Field) IsEmpty() bool {
	return len(f.Slots) == 0
}

func (f *Field) IsFull() bool {
	return len(f.Slots) >= f.MaxSlots
}

func (f *Field) SlotCount() int {
	return len(f.Slots)
}

func generateSlotID(fieldID string, slotIndex int) string {
	return fieldID + "-slot-" + fmt.Sprintf("%d", slotIndex)
}
