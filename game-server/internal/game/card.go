package game

type CardType string

type Card struct {
	ID            string      `json:"cardId"`
	Name          CardType    `json:"cardName"`
	FrontImage    string      `json:"frontImage"`
	BackImage     string      `json:"backImage"`
	NumCards      string      `json:"num_cards"`
	MoneyExchange map[int]int `json:"money_exchange"`
}
