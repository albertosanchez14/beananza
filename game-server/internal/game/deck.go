package game

import (
	"fmt"
	"math/rand"
	"time"
)

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
		{CardTypeJudicultor, 6, map[int]int{1: 1, 2: 2, 3: 3, 4: 4}},
		{CardTypeColora, 8, map[int]int{1: 1, 2: 2, 6: 3, 4: 4}},
		{CardTypeRocky, 10, map[int]int{1: 1, 2: 2, 6: 3, 4: 4}},
		{CardTypeHippy, 12, map[int]int{1: 1, 2: 2, 7: 3, 4: 4}},
		{CardTypePocha, 14, map[int]int{1: 1, 2: 2, 7: 3, 4: 4}},
		{CardTypeApestosa, 16, map[int]int{1: 1, 2: 2, 3: 3, 4: 4}},
		{CardTypeBoom, 18, map[int]int{1: 1, 2: 2, 3: 3, 4: 4}},
		{CardTypeBill, 20, map[int]int{1: 1, 2: 2, 3: 3, 4: 4}},
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

func (d *Deck) Size() int {
	return len(d.Cards)
}

func (d *Deck) IsEmpty() bool {
	return len(d.Cards) == 0
}

func (d *Deck) Peek() *Card {
	if len(d.Cards) == 0 {
		return nil
	}
	return d.Cards[0]
}

// AddCards adds cards to the deck
func (d *Deck) AddCards(cards []*Card) {
	d.Cards = append(d.Cards, cards...)
}

// generateCardID generates a unique card ID
func generateCardID(id int) string {
	return fmt.Sprintf("card-%d", id)
}

// GetExchangeRates returns the money exchange rates for a given card type.
// These must match the definitions in NewDeck exactly.
func GetExchangeRates(cardType CardType) map[int]int {
	exchangeRates := map[CardType]map[int]int{
		CardTypeJudicultor: {1: 1, 2: 2, 3: 3, 4: 4},
		CardTypeColora:     {1: 1, 2: 2, 6: 3, 4: 4},
		CardTypeRocky:      {1: 1, 2: 2, 6: 3, 4: 4},
		CardTypeHippy:      {1: 1, 2: 2, 7: 3, 4: 4},
		CardTypePocha:      {1: 1, 2: 2, 7: 3, 4: 4},
		CardTypeApestosa:   {1: 1, 2: 2, 3: 3, 4: 4},
		CardTypeBoom:       {1: 1, 2: 2, 3: 3, 4: 4},
		CardTypeBill:       {1: 1, 2: 2, 3: 3, 4: 4},
	}

	if rates, ok := exchangeRates[cardType]; ok {
		return rates
	}
	return map[int]int{}
}

// CreateCards creates card instances for a given card type and count
// Used when adding cards to discard pile from harvested fields
func CreateCards(cardType CardType, count int, cardIds []string) []*Card {
	if count <= 0 {
		return []*Card{}
	}

	cards := make([]*Card, count)
	exchangeRates := GetExchangeRates(cardType)

	for i := range count {
		cards[i] = &Card{
			ID:            cardIds[i],
			Name:          cardType,
			NumCards:      "",
			MoneyExchange: exchangeRates,
		}
	}

	return cards
}
