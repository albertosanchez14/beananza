package testutil

import (
	"fmt"
	"time"

	"github.com/yourusername/game-server/internal/game"
)

// Test player fixtures
var (
	FixturePlayerAlice = PlayerFixture{
		ID:   "player-alice",
		Name: "Alice",
	}

	FixturePlayerBob = PlayerFixture{
		ID:   "player-bob",
		Name: "Bob",
	}

	FixturePlayerCharlie = PlayerFixture{
		ID:   "player-charlie",
		Name: "Charlie",
	}

	FixturePlayerDiana = PlayerFixture{
		ID:   "player-diana",
		Name: "Diana",
	}
)

// PlayerFixture represents test player data
type PlayerFixture struct {
	ID   string
	Name string
}

// CreateTestPlayers returns a slice of test players
func CreateTestPlayers(count int) []*game.Player {
	fixtures := []PlayerFixture{
		FixturePlayerAlice,
		FixturePlayerBob,
		FixturePlayerCharlie,
		FixturePlayerDiana,
	}

	players := make([]*game.Player, 0, count)
	for i := 0; i < count && i < len(fixtures); i++ {
		fixture := fixtures[i]
		fieldID := fmt.Sprintf("field-%s", fixture.ID)
		players = append(players, &game.Player{
			ID:       fixture.ID,
			Name:     fixture.Name,
			Status:   "active",
			Coins:    0,
			Hand:     make([]*game.Card, 0),
			Field:    game.NewField(fieldID, 2),
			JoinedAt: time.Now(),
		})
	}

	return players
}

// CreateTestCard creates a single test card
func CreateTestCard(id string, cardType game.CardType) *game.Card {
	// Default money exchange rates (number of cards -> coins)
	moneyExchange := map[int]int{
		1: 1,
		2: 2,
		3: 3,
		4: 4,
	}

	return &game.Card{
		ID:            id,
		Name:          cardType,
		NumCards:      "20", // Default deck size
		MoneyExchange: moneyExchange,
	}
}

// CreateTestCards returns multiple test cards of the same type
func CreateTestCards(cardType game.CardType, count int) []*game.Card {
	cards := make([]*game.Card, count)
	for i := 0; i < count; i++ {
		cardID := fmt.Sprintf("card-%s-%d", cardType, i)
		cards[i] = CreateTestCard(cardID, cardType)
	}
	return cards
}

// CreateTestDeck returns a test deck with predictable cards
func CreateTestDeck() []*game.Card {
	cards := make([]*game.Card, 0)

	// Create a small deck with variety of card types
	cardTypes := []game.CardType{
		game.CardTypeJudicultor,
		game.CardTypeColora,
		game.CardTypeRocky,
		game.CardTypeHippy,
		game.CardTypePocha,
		game.CardTypeApestosa,
		game.CardTypeBoom,
		game.CardTypeBill,
	}

	cardID := 0
	for _, cardType := range cardTypes {
		// Create 3 cards of each type for testing (24 cards total)
		for i := 0; i < 3; i++ {
			cards = append(cards, CreateTestCard(fmt.Sprintf("card-%d", cardID), cardType))
			cardID++
		}
	}

	return cards
}

// CreateTestGameState returns a game state in specific phase
func CreateTestGameState(roomID string, phase string, playerCount int) *game.State {
	state := game.NewState(roomID)

	// Add players
	players := CreateTestPlayers(playerCount)
	for _, player := range players {
		state.AddPlayer(player.ID, player.Name)
	}

	// Set phase if not waiting
	if phase != "waiting" {
		switch phase {
		case "plantHand":
			state.SetPhase(game.PhaseTypePlantHand)
		case "turnTrade":
			state.SetPhase(game.PhaseTypeTurnTrade)
		case "plantTrade":
			state.SetPhase(game.PhaseTypePlantTrade)
		case "withdraw":
			state.SetPhase(game.PhaseTypeWithdraw)
		default:
			state.Phase = game.PhaseType(phase) // For custom phases like "playing", "finished"
		}
	}

	return state
}

// GameStateBuilder provides a fluent API for building complex game states
type GameStateBuilder struct {
	state *game.State
}

// NewGameStateBuilder creates a new game state builder
func NewGameStateBuilder(roomID string) *GameStateBuilder {
	return &GameStateBuilder{
		state: game.NewState(roomID),
	}
}

// WithPhase sets the game phase
func (b *GameStateBuilder) WithPhase(phase string) *GameStateBuilder {
	b.state.Phase = game.PhaseType(phase)
	return b
}

// WithPlayer adds a player to the state
func (b *GameStateBuilder) WithPlayer(playerID, playerName string) *GameStateBuilder {
	b.state.AddPlayer(playerID, playerName)
	return b
}

// WithPlayers adds multiple players
func (b *GameStateBuilder) WithPlayers(count int) *GameStateBuilder {
	players := CreateTestPlayers(count)
	for _, player := range players {
		b.state.AddPlayer(player.ID, player.Name)
	}
	return b
}

// WithPlayerCoins sets coins for a player
func (b *GameStateBuilder) WithPlayerCoins(playerID string, coins int) *GameStateBuilder {
	b.state.UpdatePlayerCoins(playerID, coins)
	return b
}

// WithPlayerHand sets hand cards for a player
func (b *GameStateBuilder) WithPlayerHand(playerID string, cards []*game.Card) *GameStateBuilder {
	if player, ok := b.state.GetPlayer(playerID); ok {
		player.Hand = cards
	}
	return b
}

// WithCurrentTurn sets the current turn index
func (b *GameStateBuilder) WithCurrentTurn(turnIndex int) *GameStateBuilder {
	b.state.CurrentTurn = turnIndex
	return b
}

// WithTurnOrder sets the turn order
func (b *GameStateBuilder) WithTurnOrder(playerIDs []string) *GameStateBuilder {
	turnOrder := make([]*game.Player, 0, len(playerIDs))
	for _, playerID := range playerIDs {
		if player, ok := b.state.GetPlayer(playerID); ok {
			turnOrder = append(turnOrder, player)
		}
	}
	b.state.TurnOrder = turnOrder
	return b
}

// WithData adds custom data to the state
func (b *GameStateBuilder) WithData(key string, value interface{}) *GameStateBuilder {
	b.state.SetData(key, value)
	return b
}

// Build returns the constructed state
func (b *GameStateBuilder) Build() *game.State {
	return b.state
}

// Pre-built fixture states

// FixtureGameStateWaiting returns a state with 2 players in waiting phase
func FixtureGameStateWaiting(roomID string) *game.State {
	return NewGameStateBuilder(roomID).
		WithPhase("waiting").
		WithPlayer(FixturePlayerAlice.ID, FixturePlayerAlice.Name).
		WithPlayer(FixturePlayerBob.ID, FixturePlayerBob.Name).
		Build()
}

// FixtureGameStatePlantPhase returns a state with 2 players in plant phase with cards
func FixtureGameStatePlantPhase(roomID string) *game.State {
	aliceCards := CreateTestCards(game.CardTypeJudicultor, 5)
	bobCards := CreateTestCards(game.CardTypeColora, 5)

	return NewGameStateBuilder(roomID).
		WithPhase("plantHand").
		WithPlayer(FixturePlayerAlice.ID, FixturePlayerAlice.Name).
		WithPlayer(FixturePlayerBob.ID, FixturePlayerBob.Name).
		WithPlayerHand(FixturePlayerAlice.ID, aliceCards).
		WithPlayerHand(FixturePlayerBob.ID, bobCards).
		WithTurnOrder([]string{FixturePlayerAlice.ID, FixturePlayerBob.ID}).
		WithCurrentTurn(0).
		Build()
}

// FixtureGameStateWithCoins returns a state with players having coins
func FixtureGameStateWithCoins(roomID string) *game.State {
	return NewGameStateBuilder(roomID).
		WithPhase("plantHand").
		WithPlayer(FixturePlayerAlice.ID, FixturePlayerAlice.Name).
		WithPlayer(FixturePlayerBob.ID, FixturePlayerBob.Name).
		WithPlayerCoins(FixturePlayerAlice.ID, 5).
		WithPlayerCoins(FixturePlayerBob.ID, 3).
		Build()
}

// FixtureDeckSmall returns a small deck for faster tests
func FixtureDeckSmall() []*game.Card {
	cards := make([]*game.Card, 20)
	for i := 0; i < 20; i++ {
		cardType := game.CardTypeJudicultor
		if i%2 == 0 {
			cardType = game.CardTypeColora
		}
		cards[i] = CreateTestCard(fmt.Sprintf("card-%d", i), cardType)
	}
	return cards
}

// RoomIDGenerator generates unique room IDs for tests
type RoomIDGenerator struct {
	counter int
}

// NewRoomIDGenerator creates a new room ID generator
func NewRoomIDGenerator() *RoomIDGenerator {
	return &RoomIDGenerator{counter: 0}
}

// Next generates the next room ID
func (g *RoomIDGenerator) Next() string {
	g.counter++
	return fmt.Sprintf("test-room-%d", g.counter)
}

// ClientIDGenerator generates unique client IDs for tests
type ClientIDGenerator struct {
	counter int
}

// NewClientIDGenerator creates a new client ID generator
func NewClientIDGenerator() *ClientIDGenerator {
	return &ClientIDGenerator{counter: 0}
}

// Next generates the next client ID
func (g *ClientIDGenerator) Next() string {
	g.counter++
	return fmt.Sprintf("test-client-%d", g.counter)
}

// TestTimeout returns a reasonable timeout for tests
func TestTimeout() time.Duration {
	return 5 * time.Second
}

// ShortTimeout returns a short timeout for quick operations
func ShortTimeout() time.Duration {
	return 1 * time.Second
}

// LongTimeout returns a longer timeout for complex operations
func LongTimeout() time.Duration {
	return 10 * time.Second
}
