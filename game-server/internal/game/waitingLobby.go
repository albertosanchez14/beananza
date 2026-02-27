package game

import "time"

type WaitingPlayer struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Ready    bool      `json:"ready"`
	JoinedAt time.Time `json:"joined_at"`
}

type WaitingLobby struct {
	RoomID     string
	Players    map[string]*WaitingPlayer
	MaxPlayers int
	MinPlayers int
	UpdatedAt  time.Time
}

func NewWaitingLobby(roomID string) *WaitingLobby {
	return &WaitingLobby{
		RoomID:     roomID,
		MaxPlayers: MAX_NUMBER_PLAYERS,
		MinPlayers: MIN_NUMBER_PLAYERS,
		Players:    make(map[string]*WaitingPlayer, 0),
	}
}

func (wl *WaitingLobby) GetPlayer(playerId string) (*WaitingPlayer, bool) {
	player, ok := wl.Players[playerId]
	return player, ok
}

func (wl *WaitingLobby) AddPlayer(playerID string, playerName string) error {
	if len(wl.Players) >= wl.MaxPlayers {
		return NewWaitingLobbyFullError()
	}
	player := &WaitingPlayer{
		ID:    playerID,
		Name:  playerName,
		Ready: false,
	}
	wl.Players[playerID] = player
	return nil
}

// SetPlayerReady sets the ready state for a player during the waiting phase
func (wl *WaitingLobby) SetPlayerReady(playerID string, ready bool) error {
	player, ok := wl.GetPlayer(playerID)
	if !ok {
		return NewPlayerNotFoundError(playerID)
	}

	player.Ready = ready
	wl.UpdatedAt = time.Now()
	return nil
}

// CanStartGame checks whether all conditions to start the game are met.
// Returns true if the game can start, or false with an error describing why not.
func (wl *WaitingLobby) CanStartGame() (bool, error) {
	if len(wl.Players) < wl.MinPlayers {
		return false, NewNotEnoughPlayersError(len(wl.Players), wl.MinPlayers)
	}

	readyCount := 0
	for _, player := range wl.Players {
		if player.Ready {
			readyCount++
		}
	}

	if readyCount != len(wl.Players) {
		return false, NewNotAllPlayersReadyError(readyCount, len(wl.Players))
	}

	return true, nil
}
