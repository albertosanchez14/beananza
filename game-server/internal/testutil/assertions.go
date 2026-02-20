package testutil

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/yourusername/game-server/internal/game"
	"github.com/yourusername/game-server/pkg/protocol"
)

// AssertMessageType checks that a message has the expected type
func AssertMessageType(t *testing.T, msg *protocol.Message, expected protocol.MessageType) {
	t.Helper()
	if msg.Type != expected {
		t.Errorf("expected message type %s, got %s", expected, msg.Type)
	}
}

// AssertMessageRoomID checks that a message has the expected room ID
func AssertMessageRoomID(t *testing.T, msg *protocol.Message, expectedRoomID string) {
	t.Helper()
	if msg.RoomID != expectedRoomID {
		t.Errorf("expected room ID %s, got %s", expectedRoomID, msg.RoomID)
	}
}

// AssertStatePayload parses and validates state payload, returns the state
func AssertStatePayload(t *testing.T, msg *protocol.Message) map[string]interface{} {
	t.Helper()

	if msg.Type != protocol.MessageTypeState {
		t.Fatalf("expected state message, got %s", msg.Type)
	}

	var statePayload protocol.StatePayload
	if err := msg.ParsePayload(&statePayload); err != nil {
		t.Fatalf("failed to parse state payload: %v", err)
	}

	// Convert to map for easier inspection
	stateMap, ok := statePayload.State.(map[string]interface{})
	if !ok {
		t.Fatalf("state is not a map")
	}

	return stateMap
}

// AssertErrorPayload verifies error message and returns the error payload
func AssertErrorPayload(t *testing.T, msg *protocol.Message, expectedCode string) protocol.ErrorPayload {
	t.Helper()

	if msg.Type != protocol.MessageTypeError {
		t.Fatalf("expected error message, got %s", msg.Type)
	}

	var errPayload protocol.ErrorPayload
	if err := msg.ParsePayload(&errPayload); err != nil {
		t.Fatalf("failed to parse error payload: %v", err)
	}

	if errPayload.Code != expectedCode {
		t.Errorf("expected error code %s, got %s (message: %s)", expectedCode, errPayload.Code, errPayload.Message)
	}

	return errPayload
}

// AssertBroadcastEvent checks broadcast event type and returns the broadcast payload
func AssertBroadcastEvent(t *testing.T, msg *protocol.Message, expectedEvent string) protocol.BroadcastPayload {
	t.Helper()

	if msg.Type != protocol.MessageTypeBroadcast {
		t.Fatalf("expected broadcast message, got %s", msg.Type)
	}

	var broadcastPayload protocol.BroadcastPayload
	if err := msg.ParsePayload(&broadcastPayload); err != nil {
		t.Fatalf("failed to parse broadcast payload: %v", err)
	}

	if broadcastPayload.Event != expectedEvent {
		t.Errorf("expected broadcast event %s, got %s", expectedEvent, broadcastPayload.Event)
	}

	return broadcastPayload
}

// AssertPlayerInState verifies player exists in game state
func AssertPlayerInState(t *testing.T, stateMap map[string]interface{}, playerID string) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		t.Fatalf("players field not found or not a map")
	}

	if _, exists := players[playerID]; !exists {
		t.Errorf("player %s not found in state", playerID)
	}
}

// AssertPlayerNotInState verifies player does not exist in game state
func AssertPlayerNotInState(t *testing.T, stateMap map[string]interface{}, playerID string) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		// No players at all is fine
		return
	}

	if _, exists := players[playerID]; exists {
		t.Errorf("player %s should not be in state", playerID)
	}
}

// AssertGamePhase checks current game phase
func AssertGamePhase(t *testing.T, stateMap map[string]interface{}, expectedPhase string) {
	t.Helper()

	phase, ok := stateMap["phase"].(string)
	if !ok {
		t.Fatalf("phase field not found or not a string")
	}

	if phase != expectedPhase {
		t.Errorf("expected phase %s, got %s", expectedPhase, phase)
	}
}

// AssertPlayerCoins verifies player coin count
func AssertPlayerCoins(t *testing.T, stateMap map[string]interface{}, playerID string, expectedCoins int) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		t.Fatalf("players field not found or not a map")
	}

	playerData, exists := players[playerID]
	if !exists {
		t.Fatalf("player %s not found in state", playerID)
	}

	playerMap, ok := playerData.(map[string]interface{})
	if !ok {
		t.Fatalf("player data is not a map")
	}

	coins, ok := playerMap["coins"].(float64) // JSON numbers are float64
	if !ok {
		t.Fatalf("coins field not found or not a number")
	}

	if int(coins) != expectedCoins {
		t.Errorf("expected player %s to have %d coins, got %d", playerID, expectedCoins, int(coins))
	}
}

// AssertPlayerHandCount verifies player hand card count
func AssertPlayerHandCount(t *testing.T, stateMap map[string]interface{}, playerID string, expectedCount int) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		t.Fatalf("players field not found or not a map")
	}

	playerData, exists := players[playerID]
	if !exists {
		t.Fatalf("player %s not found in state", playerID)
	}

	playerMap, ok := playerData.(map[string]interface{})
	if !ok {
		t.Fatalf("player data is not a map")
	}

	hand, ok := playerMap["hand"].([]interface{})
	if !ok {
		t.Fatalf("hand field not found or not an array")
	}

	if len(hand) != expectedCount {
		t.Errorf("expected player %s to have %d cards in hand, got %d", playerID, expectedCount, len(hand))
	}
}

// AssertFieldBeans verifies beans in player's field (simplified - checks if field has cards)
func AssertFieldBeans(t *testing.T, stateMap map[string]interface{}, playerID, fieldID string, expectedCount int) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		t.Fatalf("players field not found or not a map")
	}

	playerData, exists := players[playerID]
	if !exists {
		t.Fatalf("player %s not found in state", playerID)
	}

	playerMap, ok := playerData.(map[string]interface{})
	if !ok {
		t.Fatalf("player data is not a map")
	}

	field, ok := playerMap["field"].(map[string]interface{})
	if !ok {
		t.Fatalf("field not found or not a map")
	}

	slots, ok := field["slots"].([]interface{})
	if !ok {
		t.Fatalf("field slots not found or not an array")
	}

	totalBeans := 0
	for _, slot := range slots {
		slotMap, ok := slot.(map[string]interface{})
		if !ok {
			continue
		}
		cards, ok := slotMap["cards"].([]interface{})
		if ok {
			totalBeans += len(cards)
		}
	}

	if totalBeans != expectedCount {
		t.Errorf("expected field %s to have %d beans, got %d", fieldID, expectedCount, totalBeans)
	}
}

// AssertPlayerCount verifies the number of players in state
func AssertPlayerCount(t *testing.T, stateMap map[string]interface{}, expectedCount int) {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		if expectedCount == 0 {
			return // No players is fine if expected count is 0
		}
		t.Fatalf("players field not found or not a map")
	}

	if len(players) != expectedCount {
		t.Errorf("expected %d players, got %d", expectedCount, len(players))
	}
}

// AssertDeckSize verifies the deck size
func AssertDeckSize(t *testing.T, stateMap map[string]interface{}, expectedSize int) {
	t.Helper()

	deckSize, ok := stateMap["deck_size"].(float64)
	if !ok {
		t.Fatalf("deck_size field not found or not a number")
	}

	if int(deckSize) != expectedSize {
		t.Errorf("expected deck size %d, got %d", expectedSize, int(deckSize))
	}
}

// AssertCenterCardsCount verifies the number of center cards
func AssertCenterCardsCount(t *testing.T, stateMap map[string]interface{}, expectedCount int) {
	t.Helper()

	centerCards, ok := stateMap["center_cards"].([]interface{})
	if !ok {
		if expectedCount == 0 {
			return // No center cards is fine if expected count is 0
		}
		t.Fatalf("center_cards field not found or not an array")
	}

	if len(centerCards) != expectedCount {
		t.Errorf("expected %d center cards, got %d", expectedCount, len(centerCards))
	}
}

// AssertCurrentTurn verifies the current turn index
func AssertCurrentTurn(t *testing.T, stateMap map[string]interface{}, expectedTurn int) {
	t.Helper()

	currentTurn, ok := stateMap["current_turn"].(float64)
	if !ok {
		t.Fatalf("current_turn field not found or not a number")
	}

	if int(currentTurn) != expectedTurn {
		t.Errorf("expected current turn %d, got %d", expectedTurn, int(currentTurn))
	}
}

// GetPlayerFromState extracts a player from state map
func GetPlayerFromState(t *testing.T, stateMap map[string]interface{}, playerID string) map[string]interface{} {
	t.Helper()

	players, ok := stateMap["players"].(map[string]interface{})
	if !ok {
		t.Fatalf("players field not found or not a map")
	}

	playerData, exists := players[playerID]
	if !exists {
		t.Fatalf("player %s not found in state", playerID)
	}

	playerMap, ok := playerData.(map[string]interface{})
	if !ok {
		t.Fatalf("player data is not a map")
	}

	return playerMap
}

// GetPlayerIDFromTurnOrder gets the player ID at the specified turn index
func GetPlayerIDFromTurnOrder(t *testing.T, stateMap map[string]interface{}, turnIndex int) string {
	t.Helper()

	turnOrder, ok := stateMap["turn_order"].([]interface{})
	if !ok {
		t.Fatalf("turn_order field not found or not an array")
	}

	if turnIndex >= len(turnOrder) {
		t.Fatalf("turn index %d out of range (turn order length: %d)", turnIndex, len(turnOrder))
	}

	playerData, ok := turnOrder[turnIndex].(map[string]interface{})
	if !ok {
		t.Fatalf("turn order entry is not a map")
	}

	playerID, ok := playerData["id"].(string)
	if !ok {
		t.Fatalf("player ID not found in turn order")
	}

	return playerID
}

// ParseGameStateFromMessage extracts game.State from a state message
func ParseGameStateFromMessage(t *testing.T, msg *protocol.Message) *game.State {
	t.Helper()

	stateMap := AssertStatePayload(t, msg)

	// Marshal back to JSON and unmarshal into game.State
	jsonData, err := json.Marshal(stateMap)
	if err != nil {
		t.Fatalf("failed to marshal state: %v", err)
	}

	var state game.State
	if err := json.Unmarshal(jsonData, &state); err != nil {
		t.Fatalf("failed to unmarshal state: %v", err)
	}

	return &state
}

// AssertNoError fails the test if an error is not nil
func AssertNoError(t *testing.T, err error, message string) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: %v", message, err)
	}
}

// AssertError fails the test if an error is nil
func AssertError(t *testing.T, err error, message string) {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: expected error but got nil", message)
	}
}

// AssertEqual checks if two values are equal
func AssertEqual(t *testing.T, expected, actual interface{}, message string) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s: expected %v, got %v", message, expected, actual)
	}
}

// AssertNotEqual checks if two values are not equal
func AssertNotEqual(t *testing.T, notExpected, actual interface{}, message string) {
	t.Helper()
	if notExpected == actual {
		t.Errorf("%s: expected value to not be %v", message, notExpected)
	}
}

// AssertTrue checks if a condition is true
func AssertTrue(t *testing.T, condition bool, message string) {
	t.Helper()
	if !condition {
		t.Errorf("%s: expected true, got false", message)
	}
}

// AssertFalse checks if a condition is false
func AssertFalse(t *testing.T, condition bool, message string) {
	t.Helper()
	if condition {
		t.Errorf("%s: expected false, got true", message)
	}
}

// AssertContains checks if a string contains a substring
func AssertContains(t *testing.T, haystack, needle, message string) {
	t.Helper()
	if haystack == "" || needle == "" {
		t.Fatalf("%s: empty string provided", message)
	}
	// Simple contains check
	found := false
	for i := 0; i <= len(haystack)-len(needle); i++ {
		if haystack[i:i+len(needle)] == needle {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("%s: '%s' does not contain '%s'", message, haystack, needle)
	}
}

// AssertMessagesReceived verifies that messages were received
func AssertMessagesReceived(t *testing.T, messages []*protocol.Message, expectedCount int) {
	t.Helper()
	if len(messages) != expectedCount {
		t.Errorf("expected %d messages, received %d", expectedCount, len(messages))
	}
}

// PrintMessage is a debug helper to print message details
func PrintMessage(t *testing.T, msg *protocol.Message) {
	t.Helper()
	t.Logf("Message: Type=%s, RoomID=%s, PlayerID=%s, Timestamp=%s",
		msg.Type, msg.RoomID, msg.PlayerID, msg.Timestamp)
	if msg.Payload != nil {
		t.Logf("  Payload: %s", string(msg.Payload))
	}
}

// FormatError creates a formatted error message
func FormatError(format string, args ...interface{}) error {
	return fmt.Errorf(format, args...)
}
