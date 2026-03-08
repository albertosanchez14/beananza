package game

import (
	"fmt"
	"math/rand"
	"time"

	gameconfig "github.com/yourusername/game-server/internal/config"
)

// loadCardConfig is a convenience alias so the rest of this file reads cleanly.
func loadCardConfig() gameconfig.CardsConfig {
	return gameconfig.LoadCards()
}

type Deck struct {
	Cards []*Card
}

// NewDeck creates a standard bean game deck from the cards.yaml configuration.
func NewDeck() *Deck {
	cfg := loadCardConfig()

	totalCards := 0
	for _, ct := range cfg.CardTypes {
		totalCards += ct.Count
	}

	cards := make([]*Card, 0, totalCards)
	cardID := 1

	for _, ct := range cfg.CardTypes {
		cardType := CardType(ct.Name)
		for i := 0; i < ct.Count; i++ {
			cards = append(cards, &Card{
				ID:            generateCardID(cardID),
				Name:          cardType,
				NumCards:      fmt.Sprintf("%d", ct.Count),
				MoneyExchange: ct.ExchangeRates,
			})
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
// The data is sourced from cards.yaml — there is no separate hardcoded table.
func GetExchangeRates(cardType CardType) map[int]int {
	cfg := loadCardConfig()
	for _, ct := range cfg.CardTypes {
		if CardType(ct.Name) == cardType {
			return ct.ExchangeRates
		}
	}
	return map[int]int{}
}

// CreateCards creates card instances for a given card type and count.
// Used when adding cards to the discard pile from harvested fields.
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
