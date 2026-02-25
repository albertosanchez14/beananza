package game

type PhaseType string

const (
	PhaseTypePlantHand  PhaseType = "plantHand"
	PhaseTypeTurnTrade  PhaseType = "turnTrade"
	PhaseTypePlantTrade PhaseType = "plantTrade"
	PhaseTypeDrawCards  PhaseType = "drawCards"
	PhaseTypeWaiting    PhaseType = "waiting"
	PhaseTypeFinished   PhaseType = "finished"
)

var gamePhases = []PhaseType{PhaseTypePlantHand, PhaseTypeTurnTrade, PhaseTypePlantTrade, PhaseTypeDrawCards}

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

// ResetPhase changes to the first phase
func (p *PhaseType) ResetPhase() {
	*p = gamePhases[0]
}
