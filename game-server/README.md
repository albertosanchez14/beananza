# Game Server

A WebSocket-based game server built with Go using [gorilla/websocket](https://github.com/gorilla/websocket).

## Features

- WebSocket communication for real-time gameplay
- Room/channel-based game sessions
- Message broadcasting within rooms
- Redis integration for message persistence and game state storage
- Structured logging with configurable log levels
- Graceful shutdown handling
- Concurrent connection handling

## Architecture

### Project Structure

```
game-server/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go           # Configuration management
│   ├── server/
│   │   └── server.go           # HTTP/WebSocket server
│   ├── websocket/
│   │   ├── client.go           # WebSocket client
│   │   ├── hub.go              # Connection manager
│   │   └── room.go             # Game room logic
│   ├── game/
│   │   ├── session.go          # Game session management
│   │   └── state.go            # Game state
│   ├── storage/
│   │   └── redis.go            # Redis persistence
│   └── logger/
│       └── logger.go           # Structured logging
├── pkg/
│   └── protocol/
│       └── messages.go         # Message protocol definitions
└── scripts/
    └── run-redis.sh            # Helper scripts
```

### Key Components

- **Hub**: Central manager for all WebSocket connections
- **Client**: Represents individual WebSocket connections with read/write pumps
- **Room**: Manages game sessions with multiple players
- **Protocol**: Defines message types (join, leave, move) and structure
- **Storage**: Redis-backed persistence for messages and game state

## Requirements

- Go 1.21 or higher
- Redis 6.0 or higher

## Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure as needed
3. Install dependencies:

```bash
make deps
```

## Configuration

Configuration is managed through environment variables. See `.env.example` for all available options:

```env
SERVER_HOST=localhost
SERVER_PORT=8080
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
LOG_LEVEL=info
READ_BUFFER_SIZE=1024
WRITE_BUFFER_SIZE=1024
```

## Usage

### Start Redis

Using Docker:
```bash
make redis-up
```

Or manually:
```bash
redis-server
```

### Run the Server

```bash
make run
```

Or build and run:
```bash
make build
./game-server
```

### WebSocket Connection

Connect to the WebSocket endpoint:
```
ws://localhost:8080/ws
```

## Message Protocol

All messages follow this JSON structure:

```json
{
  "type": "join|leave|move|error|broadcast",
  "room_id": "game-123",
  "player_id": "player-456",
  "payload": {},
  "timestamp": "2026-02-13T10:00:00Z"
}
```

### Message Types

#### Join Room
```json
{
  "type": "join",
  "room_id": "game-123",
  "player_id": "player-456",
  "payload": {
    "player_name": "Alice",
    "metadata": {}
  }
}
```

#### Leave Room
```json
{
  "type": "leave",
  "room_id": "game-123",
  "player_id": "player-456",
  "payload": {
    "reason": "User left"
  }
}
```

#### Make Move
```json
{
  "type": "move",
  "room_id": "game-123",
  "player_id": "player-456",
  "payload": {
    "action": "play_card",
    "data": {
      "card_id": "ace-spades"
    }
  }
}
```

## Development

### Run with Hot Reload

Install [air](https://github.com/cosmtrek/air):
```bash
go install github.com/cosmtrek/air@latest
```

Then run:
```bash
make dev
```

### Run Tests

```bash
make test
```

### Code Formatting

```bash
make fmt
```

### Linting

```bash
make lint
```

## Available Make Commands

```bash
make help          # Show all available commands
make deps          # Download dependencies
make build         # Build the application
make run           # Run the application
make dev           # Run with hot reload
make test          # Run tests
make test-coverage # Run tests with coverage report
make clean         # Clean build artifacts
make fmt           # Format code
make lint          # Run linter
make redis-up      # Start Redis using Docker
make redis-down    # Stop Redis container
make redis-cli     # Connect to Redis CLI
```

## Deployment

### Docker

Build image:
```bash
make docker-build
```

Run container:
```bash
make docker-run
```

## Architecture Decisions

### Hub Pattern
The Hub pattern centralizes connection management, making it easy to broadcast messages and manage rooms efficiently.

### Gorilla WebSocket
Industry-standard WebSocket library with excellent performance and reliability.

### Redis Storage
Provides fast, persistent storage for game state and message history with built-in pub/sub for future horizontal scaling.

### Structured Logging
Uses uber/zap for high-performance structured logging with configurable levels.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
