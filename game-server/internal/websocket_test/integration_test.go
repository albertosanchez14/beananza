package websocket_test

import (
	"testing"
	"time"

	"github.com/yourusername/game-server/internal/testutil"
	"github.com/yourusername/game-server/pkg/protocol"
)

// TestIntegration_SingleClientJoin tests a single client joining a room
func TestIntegration_SingleClientJoin(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	// Create and connect client
	client := testutil.NewWSTestClient(t)
	err = client.Connect(server.URL)
	testutil.AssertNoError(t, err, "failed to connect client")
	defer client.Close()

	// Send join message
	joinMsg := testutil.JoinMessage("test-room-1", "Alice")
	err = client.SendMessage(joinMsg)
	testutil.AssertNoError(t, err, "failed to send join message")

	// Expect state message
	stateMsg, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "failed to receive state message")

	// Verify state
	stateMap := testutil.AssertStatePayload(t, stateMsg)
	testutil.AssertGamePhase(t, stateMap, "waiting")
	testutil.AssertPlayerCount(t, stateMap, 1)
	testutil.AssertMessageRoomID(t, stateMsg, "test-room-1")

	// Wait for room to be created
	err = server.WaitForRoomClients("test-room-1", 1, testutil.ShortTimeout())
	testutil.AssertNoError(t, err, "room should have 1 client")
}

// TestIntegration_MultipleClientsJoin tests multiple clients joining the same room
func TestIntegration_MultipleClientsJoin(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	// Create first client
	client1 := testutil.NewWSTestClient(t)
	err = client1.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1 failed to connect")
	defer client1.Close()

	// Client 1 joins
	joinMsg1 := testutil.JoinMessage("test-room-2", "Alice")
	err = client1.SendMessage(joinMsg1)
	testutil.AssertNoError(t, err, "client1 failed to send join")

	// Receive initial state
	stateMsg1, err := client1.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "client1 failed to receive state")

	state1 := testutil.AssertStatePayload(t, stateMsg1)
	testutil.AssertPlayerCount(t, state1, 1)

	// Create second client
	client2 := testutil.NewWSTestClient(t)
	err = client2.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2 failed to connect")
	defer client2.Close()

	// Client 2 joins
	joinMsg2 := testutil.JoinMessage("test-room-2", "Bob")
	err = client2.SendMessage(joinMsg2)
	testutil.AssertNoError(t, err, "client2 failed to send join")

	// Client 1 should receive broadcast about player joined
	broadcastMsg, err := client1.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeBroadcast)
	testutil.AssertNoError(t, err, "client1 should receive broadcast")
	testutil.AssertBroadcastEvent(t, broadcastMsg, "player_joined")

	// Client 2 should receive state
	stateMsg2, err := client2.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "client2 failed to receive state")

	state2 := testutil.AssertStatePayload(t, stateMsg2)
	testutil.AssertPlayerCount(t, state2, 2)

	// Game should auto-start with 2 players
	testutil.AssertGamePhase(t, state2, "plantBean")
}

// TestIntegration_ClientLeave tests a client leaving a room
func TestIntegration_ClientLeave(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	// Create two clients
	client1 := testutil.NewWSTestClient(t)
	err = client1.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1 failed to connect")
	defer client1.Close()

	client2 := testutil.NewWSTestClient(t)
	err = client2.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2 failed to connect")
	defer client2.Close()

	// Both join the room
	joinMsg1 := testutil.JoinMessage("test-room-3", "Alice")
	err = client1.SendMessage(joinMsg1)
	testutil.AssertNoError(t, err, "client1 join failed")

	// Wait for state
	_, err = client1.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "client1 state")

	joinMsg2 := testutil.JoinMessage("test-room-3", "Bob")
	err = client2.SendMessage(joinMsg2)
	testutil.AssertNoError(t, err, "client2 join failed")

	// Wait for both joins to complete
	time.Sleep(500 * time.Millisecond)

	// Drain initial messages
	client1.DrainMessages()
	client2.DrainMessages()

	// Client 1 leaves
	leaveMsg := testutil.LeaveMessage("test-room-3")
	err = client1.SendMessage(leaveMsg)
	testutil.AssertNoError(t, err, "client1 leave failed")

	// Client 2 should receive player_left broadcast
	broadcastMsg, err := client2.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeBroadcast)
	testutil.AssertNoError(t, err, "client2 should receive leave broadcast")
	testutil.AssertBroadcastEvent(t, broadcastMsg, "player_left")
}

// TestIntegration_StateRequest tests requesting game state
func TestIntegration_StateRequest(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	client := testutil.NewWSTestClient(t)
	err = client.Connect(server.URL)
	testutil.AssertNoError(t, err, "failed to connect")
	defer client.Close()

	// Join first
	joinMsg := testutil.JoinMessage("test-room-4", "Alice")
	err = client.SendMessage(joinMsg)
	testutil.AssertNoError(t, err, "join failed")

	// Drain join response
	_, err = client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "initial state")

	// Request state
	stateReq := testutil.StateMessage("test-room-4")
	err = client.SendMessage(stateReq)
	testutil.AssertNoError(t, err, "state request failed")

	// Should receive state
	stateMsg, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "state response")

	state := testutil.AssertStatePayload(t, stateMsg)
	testutil.AssertPlayerCount(t, state, 1)
}

// TestIntegration_InvalidMessage tests error handling for invalid messages
func TestIntegration_InvalidMessage(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	client := testutil.NewWSTestClient(t)
	err = client.Connect(server.URL)
	testutil.AssertNoError(t, err, "failed to connect")
	defer client.Close()

	// Send malformed message
	invalidMsg := testutil.MessageWithType("unknown_type", "test-room")
	err = client.SendMessage(invalidMsg)
	testutil.AssertNoError(t, err, "send invalid message")

	// Should receive error
	errMsg, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeError)
	testutil.AssertNoError(t, err, "should receive error message")

	testutil.AssertErrorPayload(t, errMsg, "unknown_message_type")
}

// TestIntegration_ActionWithoutJoin tests sending action without joining room
func TestIntegration_ActionWithoutJoin(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	client := testutil.NewWSTestClient(t)
	err = client.Connect(server.URL)
	testutil.AssertNoError(t, err, "failed to connect")
	defer client.Close()

	// Try to send action without joining
	actionMsg := testutil.ActionMessage("test-room", "player-1", "plantBean", map[string]interface{}{
		"cardId":  "card-1",
		"fieldId": "field-1",
	})
	err = client.SendMessage(actionMsg)
	testutil.AssertNoError(t, err, "send action")

	// Should receive error
	errMsg, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeError)
	testutil.AssertNoError(t, err, "should receive error")

	testutil.AssertErrorPayload(t, errMsg, "not_in_room")
}

// TestIntegration_GameAutoStart tests that game auto-starts with 2 players
func TestIntegration_GameAutoStart(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	client1 := testutil.NewWSTestClient(t)
	err = client1.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1 connect failed")
	defer client1.Close()

	client2 := testutil.NewWSTestClient(t)
	err = client2.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2 connect failed")
	defer client2.Close()

	// First player joins
	joinMsg1 := testutil.JoinMessage("test-room-5", "Alice")
	err = client1.SendMessage(joinMsg1)
	testutil.AssertNoError(t, err, "client1 join failed")

	stateMsg1, err := client1.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "client1 state")
	state1 := testutil.AssertStatePayload(t, stateMsg1)
	testutil.AssertGamePhase(t, state1, "waiting")

	// Second player joins - game should auto-start
	joinMsg2 := testutil.JoinMessage("test-room-5", "Bob")
	err = client2.SendMessage(joinMsg2)
	testutil.AssertNoError(t, err, "client2 join failed")

	// Drain client1's broadcast message
	client1.DrainMessages()

	// Client 2 receives state with game started
	stateMsg2, err := client2.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
	testutil.AssertNoError(t, err, "client2 state")
	state2 := testutil.AssertStatePayload(t, stateMsg2)

	// Game should be in plantBean phase
	testutil.AssertGamePhase(t, state2, "plantBean")
	testutil.AssertPlayerCount(t, state2, 2)

	// Should have turn order
	turnOrder, ok := state2["turn_order"].([]interface{})
	testutil.AssertTrue(t, ok, "turn_order should exist")
	testutil.AssertEqual(t, 2, len(turnOrder), "turn_order should have 2 players")
}

// TestIntegration_MultipleRooms tests multiple independent rooms
func TestIntegration_MultipleRooms(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	// Create clients for room 1
	client1a := testutil.NewWSTestClient(t)
	err = client1a.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1a connect")
	defer client1a.Close()

	client1b := testutil.NewWSTestClient(t)
	err = client1b.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1b connect")
	defer client1b.Close()

	// Create clients for room 2
	client2a := testutil.NewWSTestClient(t)
	err = client2a.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2a connect")
	defer client2a.Close()

	client2b := testutil.NewWSTestClient(t)
	err = client2b.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2b connect")
	defer client2b.Close()

	// Room 1 joins
	err = client1a.SendMessage(testutil.JoinMessage("room-1", "Alice"))
	testutil.AssertNoError(t, err, "room1 alice join")
	err = client1b.SendMessage(testutil.JoinMessage("room-1", "Bob"))
	testutil.AssertNoError(t, err, "room1 bob join")

	// Room 2 joins
	err = client2a.SendMessage(testutil.JoinMessage("room-2", "Charlie"))
	testutil.AssertNoError(t, err, "room2 charlie join")
	err = client2b.SendMessage(testutil.JoinMessage("room-2", "Diana"))
	testutil.AssertNoError(t, err, "room2 diana join")

	// Give time for all joins to process
	time.Sleep(500 * time.Millisecond)

	// Verify both rooms exist
	room1 := server.GetRoom("room-1")
	testutil.AssertTrue(t, room1 != nil, "room-1 should exist")
	testutil.AssertEqual(t, 2, room1.ClientCount(), "room-1 should have 2 clients")

	room2 := server.GetRoom("room-2")
	testutil.AssertTrue(t, room2 != nil, "room-2 should exist")
	testutil.AssertEqual(t, 2, room2.ClientCount(), "room-2 should have 2 clients")
}

// TestIntegration_ClientDisconnect tests client disconnection handling
func TestIntegration_ClientDisconnect(t *testing.T) {
	server, err := testutil.CreateTestServer(t)
	testutil.AssertNoError(t, err, "failed to create test server")
	defer server.Close()

	client1 := testutil.NewWSTestClient(t)
	err = client1.Connect(server.URL)
	testutil.AssertNoError(t, err, "client1 connect")
	defer client1.Close()

	client2 := testutil.NewWSTestClient(t)
	err = client2.Connect(server.URL)
	testutil.AssertNoError(t, err, "client2 connect")
	defer client2.Close()

	// Both join
	err = client1.SendMessage(testutil.JoinMessage("test-room-6", "Alice"))
	testutil.AssertNoError(t, err, "client1 join")
	err = client2.SendMessage(testutil.JoinMessage("test-room-6", "Bob"))
	testutil.AssertNoError(t, err, "client2 join")

	// Wait for joins to process
	time.Sleep(500 * time.Millisecond)

	// Verify room has 2 clients
	room := server.GetRoom("test-room-6")
	testutil.AssertTrue(t, room != nil, "room should exist")
	testutil.AssertEqual(t, 2, room.ClientCount(), "room should have 2 clients")

	// Client 1 disconnects abruptly (close connection)
	err = client1.Close()
	testutil.AssertNoError(t, err, "client1 close")

	// Wait for disconnect to process
	time.Sleep(500 * time.Millisecond)

	// Room should now have 1 client
	testutil.AssertEqual(t, 1, room.ClientCount(), "room should have 1 client after disconnect")
}
