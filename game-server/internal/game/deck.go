package game

import (
	"fmt"
	"math/rand"
	"time"

	gameconfig "github.com/yourusername/game-server/internal/config"
)

type Deck struct {
	Cards []*Card
}

// NewDeck creates a standard bean game deck from the provided cards configuration.
func NewDeck(cards gameconfig.CardsConfig) *Deck {
	totalCards := 0
	for _, ct := range cards.CardTypes {
		totalCards += ct.Count
	}

	cs := make([]*Card, 0, totalCards)
	cardID := 1

	for _, ct := range cards.CardTypes {
		cardType := CardType(ct.Name)
		for i := 0; i < ct.Count; i++ {
			cs = append(cs, &Card{
				ID:            generateCardID(cardID),
				Name:          cardType,
				FrontImage:    ct.FrontImage,
				BackImage:     ct.BackImage,
				NumCards:      fmt.Sprintf("%d", ct.Count),
				MoneyExchange: ct.ExchangeRates,
			})
			cardID++
		}
	}

	return &Deck{Cards: cs}
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

// PeekLast returns the last card added to the deck (top of discard pile)
// without removing it.
func (d *Deck) PeekLast() *Card {
	if len(d.Cards) == 0 {
		return nil
	}
	return d.Cards[len(d.Cards)-1]
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
// The data is sourced from the provided cards configuration.
func GetExchangeRates(cardType CardType, cards gameconfig.CardsConfig) map[int]int {
	for _, ct := range cards.CardTypes {
		if CardType(ct.Name) == cardType {
			return ct.ExchangeRates
		}
	}
	return map[int]int{}
}

// GetCardImages returns the front and back image paths for a given card type.
func GetCardImages(cardType CardType, cards gameconfig.CardsConfig) (front, back string) {
	for _, ct := range cards.CardTypes {
		if CardType(ct.Name) == cardType {
			return ct.FrontImage, ct.BackImage
		}
	}
	return "", ""
}

// CreateCards creates card instances for a given card type and count.
// Used when adding cards to the discard pile from harvested fields.
func CreateCards(cardType CardType, count int, cardIds []string, cards gameconfig.CardsConfig) []*Card {
	if count <= 0 {
		return []*Card{}
	}

	cs := make([]*Card, count)
	exchangeRates := GetExchangeRates(cardType, cards)
	frontImage, backImage := GetCardImages(cardType, cards)

	for i := range count {
		cs[i] = &Card{
			ID:            cardIds[i],
			Name:          cardType,
			FrontImage:    frontImage,
			BackImage:     backImage,
			NumCards:      "",
			MoneyExchange: exchangeRates,
		}
	}

	return cs
}
