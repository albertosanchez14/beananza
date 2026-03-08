package game

// CardType is the name of a bean card type, as defined in config/cards.yaml.
type CardType string

type Card struct {
	ID            string      `json:"cardId"`
	Name          CardType    `json:"cardName"`
	NumCards      string      `json:"num_cards"`
	MoneyExchange map[int]int `json:"money_exchange"` // maps number of cards to number of coins
}
