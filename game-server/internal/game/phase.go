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

// NextPhase changes to the next phase in order
func (p *PhaseType) NextPhase() {
	for i, phase := range gamePhases {
		if *p == phase {
			if i < len(gamePhases)-1 {
				*p = gamePhases[i+1]
			}
			return
		}
	}
}
