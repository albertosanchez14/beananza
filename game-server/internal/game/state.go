package game

import (
	"time"
)

type Player struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Status           string    `json:"status"` // "active", "idle", "disconnected"
	Coins            int       `json:"coins"`
	Hand             []*Card   `json:"hand"`
	Field            *Field    `json:"field"`
	BeansPlantedTurn int       `json:"beans_planted_turn"`
	JoinedAt         time.Time `json:"joined_at"`
}

type State struct {
	RoomID      string
	Phase       PhaseType
	Players     map[string]*Player
	CenterDeck  []*Card
	CenterCards []*Card
	TurnOrder   []string
	CurrentTurn int
	Data        map[string]interface{} // TODO: Remove?
	StartedAt   time.Time
	EndedAt     time.Time
	UpdatedAt   time.Time
}

// NewState creates a new game state
func NewState(roomID string) *State {
	return &State{
		RoomID:    roomID,
		Phase:     "waiting",
		Players:   make(map[string]*Player),
		Data:      make(map[string]interface{}),
		UpdatedAt: time.Now(),
	}
}

// AddPlayer adds a player to the game state
func (s *State) AddPlayer(playerID, playerName string) *Player {
	fieldID := "field-" + playerID
	// TODO: Change the number of fields depending on players
	field := NewField(fieldID, 2)

	player := &Player{
		ID:               playerID,
		Name:             playerName,
		Status:           "active",
		Coins:            0,
		Hand:             make([]*Card, 0),
		Field:            field,
		BeansPlantedTurn: 0,
		JoinedAt:         time.Now(),
	}

	s.Players[playerID] = player
	s.UpdatedAt = time.Now()

	return player
}

// RemovePlayer removes a player from the game state
func (s *State) RemovePlayer(playerID string) {
	delete(s.Players, playerID)
	s.UpdatedAt = time.Now()
}

// GetPlayer retrieves a player by ID
func (s *State) GetPlayer(playerID string) (*Player, bool) {
	player, ok := s.Players[playerID]
	return player, ok
}

// SetPhase updates the game phase
func (s *State) SetPhase(phase PhaseType) {
	s.Phase = phase
	s.UpdatedAt = time.Now()

	if phase == "playing" && s.StartedAt.IsZero() {
		s.StartedAt = time.Now()
	} else if phase == "finished" && s.EndedAt.IsZero() {
		s.EndedAt = time.Now()
	}
}

// GetPhase returns the current game phase
func (s *State) GetPhase() PhaseType {
	return s.Phase
}

// NextPhase changes to the next phase in order
func (s *State) NextPhase() {
	for i, phase := range gamePhases {
		if s.Phase == phase {
			if i < len(gamePhases)-1 {
				s.Phase = gamePhases[i+1]
			}
			return
		}
	}
}

// SetData sets a value in the game data
func (s *State) SetData(key string, value interface{}) {
	s.Data[key] = value
	s.UpdatedAt = time.Now()
}

// GetData retrieves a value from the game data
func (s *State) GetData(key string) (interface{}, bool) {
	value, ok := s.Data[key]
	return value, ok
}

// PlayerCount returns the number of players
func (s *State) PlayerCount() int {
	return len(s.Players)
}

// UpdatePlayerStatus updates a player's status
func (s *State) UpdatePlayerStatus(playerID, status string) {
	if player, ok := s.Players[playerID]; ok {
		player.Status = status
		s.UpdatedAt = time.Now()
	}
}

// UpdatePlayerScore updates a player's score
func (s *State) UpdatePlayerCoins(playerID string, score int) {
	if player, ok := s.Players[playerID]; ok {
		player.Coins = score
		s.UpdatedAt = time.Now()
	}
}

// Clone creates a deep copy of the state for safe reading
func (s *State) Clone() *State {
	clone := &State{
		RoomID:      s.RoomID,
		Phase:       s.Phase,
		Players:     make(map[string]*Player),
		TurnOrder:   make([]string, len(s.TurnOrder)),
		CurrentTurn: s.CurrentTurn,
		Data:        make(map[string]interface{}),
		StartedAt:   s.StartedAt,
		EndedAt:     s.EndedAt,
		UpdatedAt:   s.UpdatedAt,
	}

	for id, player := range s.Players {
		playerClone := *player
		clone.Players[id] = &playerClone
	}

	// Clone turn order (shallow copy of pointers is fine since we cloned the players)
	copy(clone.TurnOrder, s.TurnOrder)

	for key, value := range s.Data {
		clone.Data[key] = value
	}

	return clone
}
