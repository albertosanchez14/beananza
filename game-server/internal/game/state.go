package game

import (
	"sync"
	"time"
)

// State represents the current state of a game
type State struct {
	// Room ID this state belongs to
	RoomID string `json:"room_id"`

	// Current game phase (e.g., "waiting", "playing", "finished")
	Phase string `json:"phase"`

	// Players in the game
	Players map[string]*Player `json:"players"`

	// Game-specific data (flexible for different game types)
	Data map[string]interface{} `json:"data"`

	// When the game started
	StartedAt time.Time `json:"started_at,omitempty"`

	// When the game ended
	EndedAt time.Time `json:"ended_at,omitempty"`

	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// Player represents a player in the game
type Player struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Status   string                 `json:"status"` // "active", "idle", "disconnected"
	Score    int                    `json:"score"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	JoinedAt time.Time              `json:"joined_at"`
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
	s.mu.Lock()
	defer s.mu.Unlock()

	player := &Player{
		ID:       playerID,
		Name:     playerName,
		Status:   "active",
		Score:    0,
		Metadata: make(map[string]interface{}),
		JoinedAt: time.Now(),
	}

	s.Players[playerID] = player
	s.UpdatedAt = time.Now()

	return player
}

// RemovePlayer removes a player from the game state
func (s *State) RemovePlayer(playerID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.Players, playerID)
	s.UpdatedAt = time.Now()
}

// GetPlayer retrieves a player by ID
func (s *State) GetPlayer(playerID string) (*Player, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	player, ok := s.Players[playerID]
	return player, ok
}

// SetPhase updates the game phase
func (s *State) SetPhase(phase string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Phase = phase
	s.UpdatedAt = time.Now()

	if phase == "playing" && s.StartedAt.IsZero() {
		s.StartedAt = time.Now()
	} else if phase == "finished" && s.EndedAt.IsZero() {
		s.EndedAt = time.Now()
	}
}

// GetPhase returns the current game phase
func (s *State) GetPhase() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Phase
}

// SetData sets a value in the game data
func (s *State) SetData(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Data[key] = value
	s.UpdatedAt = time.Now()
}

// GetData retrieves a value from the game data
func (s *State) GetData(key string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	value, ok := s.Data[key]
	return value, ok
}

// PlayerCount returns the number of players
func (s *State) PlayerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.Players)
}

// UpdatePlayerStatus updates a player's status
func (s *State) UpdatePlayerStatus(playerID, status string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if player, ok := s.Players[playerID]; ok {
		player.Status = status
		s.UpdatedAt = time.Now()
	}
}

// UpdatePlayerScore updates a player's score
func (s *State) UpdatePlayerScore(playerID string, score int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if player, ok := s.Players[playerID]; ok {
		player.Score = score
		s.UpdatedAt = time.Now()
	}
}

// Clone creates a deep copy of the state for safe reading
func (s *State) Clone() *State {
	s.mu.RLock()
	defer s.mu.RUnlock()

	clone := &State{
		RoomID:    s.RoomID,
		Phase:     s.Phase,
		Players:   make(map[string]*Player),
		Data:      make(map[string]interface{}),
		StartedAt: s.StartedAt,
		EndedAt:   s.EndedAt,
		UpdatedAt: s.UpdatedAt,
	}

	for id, player := range s.Players {
		playerClone := *player
		clone.Players[id] = &playerClone
	}

	for key, value := range s.Data {
		clone.Data[key] = value
	}

	return clone
}
