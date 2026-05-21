# Game Server

Go WebSocket/API server for the card game.

## Requirements

- Go
- Redis

## Config

Copy the example env file for standalone local runs:

```bash
cp .env.example .env
```

Game rules are configured with env vars:

```env
CARDS_PER_TURN=2
MAX_NUMBER_PLAYERS=5
MIN_NUMBER_PLAYERS=3
MAX_RESHUFFLES=3
CARDS_PER_DRAW=3
```

Card definitions live in `cards.yaml`. Docker Compose mounts the same file at
`/app/config/cards.yaml`; standalone local runs use
`CARDS_CONFIG_PATH=cards.yaml` from `.env`.

## Run Locally

From `game-server/`:

```bash
make deps
make run
```

The server listens on [http://localhost:8080](http://localhost:8080).
WebSocket endpoint: `ws://localhost:8080/ws`.

## Development

Run with hot reload:

```bash
make dev
```

Run tests:

```bash
make test
```

Build:

```bash
make build
```
