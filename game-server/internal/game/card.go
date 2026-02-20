package game

type CardType string

const (
	CardTypeJudicultor CardType = "Judicultor"
	CardTypeColora     CardType = "Judia Colora"
	CardTypeRocky      CardType = "Rocky Judia"
	CardTypeHippy      CardType = "Hippy Judia"
	CardTypePocha      CardType = "La Pocha"
	CardTypeApestosa   CardType = "La Apestosa"
	CardTypeBoom       CardType = "Judia Boom"
	CardTypeBill       CardType = "Judia Bill"
)

type Card struct {
	ID            string      `json:"cardId"`
	Name          CardType    `json:"cardName"`
	NumCards      string      `json:"num_cards"`
	MoneyExchange map[int]int `json:"money_exchange"` // maps number of cards to number of coins
}
