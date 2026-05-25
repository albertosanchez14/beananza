# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

## Running

### Prerequisites

- Docker + Docker Compose

### 1. Local/Dev with Docker Compose

Builds local client, server, and nginx gateway images, then runs nginx, Redis,
one static Vite client, and the Go server over HTTP.

```bash
cp .env.example .env
```

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

Or use the Makefile shortcut:

```bash
make up-d
```

Open [http://localhost](http://localhost).

Game rules are configured with environment variables:

```env
CARDS_PER_TURN=2
MAX_NUMBER_PLAYERS=5
MIN_NUMBER_PLAYERS=3
MAX_RESHUFFLES=3
CARDS_PER_DRAW=3
```

Card definitions live in `./game-server/cards.yaml`. The server image includes
the default file.

```yaml
cards:
  - name: "Judicultor"
    count: 6
```

### 4. Development

Runs Redis in Docker, then runs the Go server and Vite dev server natively:

```bash
cp game-client/.env.example game-client/.env
make dev
```

- Vite dev server: [http://localhost:3000](http://localhost:3000)
- Game server API: [http://localhost:8080](http://localhost:8080)

Native Vite development requires `game-client/.env` to define
`INTERNAL_API_URL`. Vite uses it only for the local dev proxy; production
browser requests stay same-origin through nginx.

Individual targets:

```bash
make dev-server   # Redis + Go server only
make dev-client   # Vite dev server only
make redis        # Redis only (detached)
```

### Stopping

```bash
make down    # Stop containers, keep Redis/uploads volumes
make down-v  # Stop containers and remove volumes
```
