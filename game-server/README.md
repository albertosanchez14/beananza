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

Game rules and card definitions live in `game.yaml`. Docker Compose mounts the
same file at `/app/config/game.yaml`; standalone local runs use
`GAME_CONFIG_PATH=game.yaml` from `.env`.

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
