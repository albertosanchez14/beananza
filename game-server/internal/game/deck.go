package game

import (
	"math/rand"
	"time"
)

// Deck represents a deck of cards
type Deck struct {
	Cards []*Card
}

// NewDeck creates a standard bean game deck
func NewDeck() *Deck {
	cards := make([]*Card, 0, 104)

	cardDefinitions := []struct {
		cardType  CardType
		count     int
		exchanges map[int]int
	}{
		{CardTypeJudicultor, 6, map[int]int{4: 1, 5: 2, 6: 3, 7: 4}},
		{CardTypeColora, 8, map[int]int{4: 1, 5: 2, 6: 3, 7: 4}},
		{CardTypeRocky, 10, map[int]int{4: 1, 5: 2, 6: 3, 8: 4}},
		{CardTypeHippy, 12, map[int]int{5: 1, 6: 2, 7: 3, 8: 4}},
		{CardTypePocha, 14, map[int]int{5: 1, 6: 2, 7: 3, 9: 4}},
		{CardTypeApestosa, 16, map[int]int{5: 1, 7: 2, 8: 3, 9: 4}},
		{CardTypeBoom, 18, map[int]int{6: 1, 7: 2, 8: 3, 9: 4}},
		{CardTypeBill, 20, map[int]int{6: 1, 8: 2, 9: 3, 10: 4}},
	}

	cardID := 1
	for _, def := range cardDefinitions {
		for i := 0; i < def.count; i++ {
			card := &Card{
				ID:            generateCardID(cardID),
				Name:          def.cardType,
				NumCards:      string(rune('0' + def.count)),
				MoneyExchange: def.exchanges,
			}
			cards = append(cards, card)
			cardID++
		}
	}

	return &Deck{Cards: cards}
}

// Shuffle randomizes the order of cards in the deck
func (d *Deck) Shuffle() {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(d.Cards), func(i, j int) {
		d.Cards[i], d.Cards[j] = d.Cards[j], d.Cards[i]
	})
}

// Draw removes and returns the top N cards from the deck
func (d *Deck) Draw(n int) []*Card {
	if n > len(d.Cards) {
		n = len(d.Cards)
	}

	drawn := d.Cards[:n]
	d.Cards = d.Cards[n:]

	return drawn
}

// DrawOne removes and returns the top card from the deck
func (d *Deck) DrawOne() *Card {
	if len(d.Cards) == 0 {
		return nil
	}

	card := d.Cards[0]
	d.Cards = d.Cards[1:]

	return card
}

// Size returns the number of cards remaining in the deck
func (d *Deck) Size() int {
	return len(d.Cards)
}

// IsEmpty checks if the deck has no cards left
func (d *Deck) IsEmpty() bool {
	return len(d.Cards) == 0
}

// Peek returns the top card without removing it
func (d *Deck) Peek() *Card {
	if len(d.Cards) == 0 {
		return nil
	}
	return d.Cards[0]
}

// generateCardID generates a unique card ID
func generateCardID(id int) string {
	return "card-" + string(rune('0'+id/10)) + string(rune('0'+id%10))
}
