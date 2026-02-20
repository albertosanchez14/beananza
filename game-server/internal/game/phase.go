package game

type PhaseType string

const (
	PhaseTypePlantHand  PhaseType = "plantHand"
	PhaseTypeTurnTrade  PhaseType = "turnTrade"
	PhaseTypePlantTrade PhaseType = "plantTrade"
	PhaseTypeWithdraw   PhaseType = "withdraw"
	PhaseTypeWaiting    PhaseType = "waiting"
	PhaseTypePlaying    PhaseType = "playing"
	PhaseTypeFinished   PhaseType = "finished"
)

var gamePhases = []PhaseType{PhaseTypePlantHand, PhaseTypeTurnTrade, PhaseTypePlantTrade}
