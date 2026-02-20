# WebSocket Test Suite

Comprehensive test suite for the WebSocket game server implementation.

## Overview

This test suite provides comprehensive coverage of WebSocket functionality including:
- Connection lifecycle (connect, ping/pong, disconnect)
- Room join/leave flows with multiple clients
- Game state synchronization
- Error handling for invalid messages
- Multi-room scenarios
- Client disconnection handling

## Test Structure

```
internal/
├── testutil/                    # Reusable test utilities
│   ├── mocks.go                 # MockRepository for in-memory testing
│   ├── wsclient.go              # WebSocket test client
│   ├── builders.go              # Message builders (fluent API)
│   ├── assertions.go            # Custom test assertions
│   ├── fixtures.go              # Test data and fixtures
│   └── server.go                # Test server helper
│
└── websocket_test/              # Integration tests
    └── integration_test.go      # Full WebSocket flow tests
```

## Test Utilities

### MockRepository (`mocks.go`)

In-memory implementation of `storage.Repository` for testing without Redis.

```go
repo := testutil.NewMockRepository()
```

**Features:**
- Implements all Repository interface methods
- Thread-safe operations
- Test helper methods for inspecting saved data

### WSTestClient (`wsclient.go`)

WebSocket test client for easy connection and message handling.

```go
client := testutil.NewWSTestClient(t)
err := client.Connect(serverURL)
err = client.SendMessage(msg)
receivedMsg, err := client.ExpectMessage(timeout, protocol.MessageTypeState)
client.Close()
```

**Features:**
- Automatic message buffering
- Timeout support for all receives
- Helper methods for common assertions
- Thread-safe message queue

### Message Builders (`builders.go`)

Fluent API for building test messages.

```go
// Simple helpers
msg := testutil.JoinMessage("room-1", "Alice")
msg := testutil.StateMessage("room-1")
msg := testutil.ActionMessage("room-1", "player-1", "plantBean", data)

// Fluent builder
msg := testutil.NewMessageBuilder().
    Join("room-1").
    WithPlayerName("Alice").
    WithMetadata(map[string]interface{}{"level": 5}).
    Build()
```

### Assertion Helpers (`assertions.go`)

Custom assertions for WebSocket and game state testing.

```go
testutil.AssertMessageType(t, msg, protocol.MessageTypeState)
testutil.AssertGamePhase(t, stateMap, "plantBean")
testutil.AssertPlayerCount(t, stateMap, 2)
testutil.AssertPlayerCoins(t, stateMap, playerID, 5)
testutil.AssertBroadcastEvent(t, msg, "player_joined")
```

### Test Fixtures (`fixtures.go`)

Pre-built test data for consistent testing.

```go
// Player fixtures
testutil.FixturePlayerAlice
testutil.FixturePlayerBob

// Game state builders
state := testutil.NewGameStateBuilder("room-1").
    WithPhase("plantBean").
    WithPlayer(alice.ID, alice.Name).
    WithPlayerCoins(alice.ID, 5).
    Build()

// Pre-built states
state := testutil.FixtureGameStatePlantPhase("room-1")
```

### Test Server (`server.go`)

Helper to create fully configured test WebSocket servers.

```go
server, err := testutil.CreateTestServer(t)
defer server.Close()

// Access server components
room := server.GetRoom("room-1")
session, ok := server.GetGameSession("room-1")
stats := server.GetStats()
```

## Running Tests

### Run all tests
```bash
go test ./...
```

### Run WebSocket integration tests
```bash
go test ./internal/websocket_test/... -v
```

### Run with race detector
```bash
go test -race ./internal/websocket_test/...
```

### Run specific test
```bash
go test -v -run TestIntegration_MultipleClientsJoin ./internal/websocket_test
```

## Test Scenarios Covered

### Connection Lifecycle
- ✅ Single client connect and join
- ✅ Multiple clients joining same room
- ✅ Client disconnect (graceful and abrupt)

### Room Join/Leave Flows
- ✅ Single client joins room
- ✅ Multiple clients join, receive broadcasts
- ✅ Client leaves, broadcasts to others
- ✅ Room cleanup when empty
- ✅ Game auto-starts with 2+ players

### State Synchronization
- ✅ New clients receive current game state
- ✅ State requests return current state
- ✅ Broadcasts update all clients in room

### Error Conditions
- ✅ Invalid message type
- ✅ Malformed JSON
- ✅ Action without joining room
- ✅ Unknown message types

### Multi-Room Scenarios
- ✅ Multiple independent rooms
- ✅ Clients in different rooms don't interfere
- ✅ Room-specific broadcasts

### Game Flow
- ✅ Game auto-starts when 2 players join
- ✅ Turn order is established
- ✅ Phase transitions
- ✅ Players receive cards when game starts

## Test Results

All 9 integration tests passing:

```
=== RUN   TestIntegration_SingleClientJoin
--- PASS: TestIntegration_SingleClientJoin (0.00s)
=== RUN   TestIntegration_MultipleClientsJoin
--- PASS: TestIntegration_MultipleClientsJoin (0.00s)
=== RUN   TestIntegration_ClientLeave
--- PASS: TestIntegration_ClientLeave (0.00s)
=== RUN   TestIntegration_StateRequest
--- PASS: TestIntegration_StateRequest (0.00s)
=== RUN   TestIntegration_InvalidMessage
--- PASS: TestIntegration_InvalidMessage (0.00s)
=== RUN   TestIntegration_ActionWithoutJoin
--- PASS: TestIntegration_ActionWithoutJoin (0.00s)
=== RUN   TestIntegration_GameAutoStart
--- PASS: TestIntegration_GameAutoStart (0.00s)
=== RUN   TestIntegration_MultipleRooms
--- PASS: TestIntegration_MultipleRooms (0.50s)
=== RUN   TestIntegration_ClientDisconnect
--- PASS: TestIntegration_ClientDisconnect (1.00s)
PASS
ok      github.com/yourusername/game-server/internal/websocket_test    1.519s
```

## Example Test Pattern

Here's a typical test pattern showing how values from one call are used in subsequent calls:

```go
func TestExample(t *testing.T) {
    // Setup server
    server, err := testutil.CreateTestServer(t)
    testutil.AssertNoError(t, err, "server setup")
    defer server.Close()

    // Connect client
    client := testutil.NewWSTestClient(t)
    err = client.Connect(server.URL)
    testutil.AssertNoError(t, err, "connection")
    defer client.Close()

    // Join room
    joinMsg := testutil.JoinMessage("test-room", "Alice")
    err = client.SendMessage(joinMsg)
    testutil.AssertNoError(t, err, "join message")

    // Receive state - extract values for next action
    stateMsg, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
    testutil.AssertNoError(t, err, "state message")
    
    state := testutil.AssertStatePayload(t, stateMsg)
    
    // Extract player ID from received state
    playerID := testutil.GetPlayerIDFromTurnOrder(t, state, 0)
    
    // Use extracted player ID in next action
    actionMsg := testutil.PlantBeanMessage("test-room", playerID, "card-1", "field-1")
    err = client.SendMessage(actionMsg)
    testutil.AssertNoError(t, err, "action message")
    
    // Verify action result uses previous state
    updatedState, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
    testutil.AssertNoError(t, err, "updated state")
    
    // Assert using values from both calls
    newState := testutil.AssertStatePayload(t, updatedState)
    testutil.AssertFieldBeans(t, newState, playerID, "field-1", 1)
}
```

## Adding New Tests

### Integration Test Pattern

```go
func TestIntegration_NewFeature(t *testing.T) {
    // 1. Create server
    server, err := testutil.CreateTestServer(t)
    testutil.AssertNoError(t, err, "server creation")
    defer server.Close()

    // 2. Create and connect client(s)
    client := testutil.NewWSTestClient(t)
    err = client.Connect(server.URL)
    testutil.AssertNoError(t, err, "client connection")
    defer client.Close()

    // 3. Send messages and verify responses
    msg := testutil.JoinMessage("room", "Player")
    err = client.SendMessage(msg)
    testutil.AssertNoError(t, err, "send message")

    // 4. Assert expected behavior
    response, err := client.ExpectMessage(testutil.TestTimeout(), protocol.MessageTypeState)
    testutil.AssertNoError(t, err, "receive response")
    
    state := testutil.AssertStatePayload(t, response)
    testutil.AssertPlayerCount(t, state, 1)
}
```

## Key Testing Principles

1. **Use test utilities** - Don't reinvent message building or assertions
2. **Take values from responses** - Extract IDs, state values for subsequent actions
3. **Test end-to-end flows** - Verify complete interaction sequences
4. **Check side effects** - Verify broadcasts, state updates, room changes
5. **Test error conditions** - Ensure proper error handling
6. **Use timeouts** - All receives should have reasonable timeouts
7. **Clean up resources** - Always defer Close() calls

## Future Enhancements

The test suite can be extended with:

- [ ] Game action sequence tests (plant → harvest → trade flows)
- [ ] Concurrency tests (simultaneous actions from multiple clients)
- [ ] Performance/load tests (many clients, many rooms)
- [ ] Reconnection logic tests
- [ ] Message rate limiting tests
- [ ] Large message handling tests

## Notes

- Tests run without Redis (uses MockRepository)
- Tests are isolated (each creates fresh server)
- All tests use standard Go testing package
- No external test frameworks required
- Tests demonstrate values-from-calls pattern as requested
