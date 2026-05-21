# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

## Running

### Prerequisites

- Docker + Docker Compose
- `make`

### 1. Local/Dev with Docker Compose

Builds local client and server images, then runs nginx, Redis, one Next.js
client, and two replicated Go server containers over HTTP.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Or use the Makefile shortcut:

```bash
make local
```

Open [http://localhost](http://localhost).

### 2. Production with Docker Compose

`docker-compose.yml` is image-only for app services. It expects prebuilt client
and server images. Use the prod override for an HTTPS deployment on port 443:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The prod override mounts `./nginx/certs` and expects TLS certificates at:

```text
./nginx/certs/fullchain.crt
./nginx/certs/privkey.pem
```

Both Compose deploys use the same public-origin routing model: the client, API,
and WebSocket endpoint are served from the same origin. Local/dev uses HTTP;
prod uses HTTPS.

Server defaults are set directly in `docker-compose.yml`. Use a local `.env`
only for secrets or deployment-specific overrides read by compose, for example:

```env
GAME_CLIENT_IMAGE=ghcr.io/you/card-game-client
GAME_SERVER_IMAGE=ghcr.io/you/card-game-server
APP_TAG=1.0.0
PUBLIC_ORIGIN=https://game.example.com
REDIS_PASSWORD=use-a-long-random-password
REDIS_DB=0
HTTP_PORT=80
HTTPS_PORT=443
```

`REDIS_DB` must be a numeric Redis database index. Use `0` unless you have a
specific reason to separate multiple apps in the same Redis instance.

Game rules are configured with environment variables:

```env
CARDS_PER_TURN=2
MAX_NUMBER_PLAYERS=5
MIN_NUMBER_PLAYERS=3
MAX_RESHUFFLES=3
CARDS_PER_DRAW=3
```

Card definitions live in `./game-server/cards.yaml`. The server image includes
the default file; Compose also mounts it read-only to `/app/config/cards.yaml`
inside each server container:

```yaml
cards:
  - name: "Judicultor"
    count: 6
```

### 3. Development

Runs Redis in Docker, then runs the Go server and Next.js dev server natively:

```bash
make dev
```

- Next.js dev server: [http://localhost:3000](http://localhost:3000)
- Game server API: [http://localhost:8080](http://localhost:8080)

Individual targets:

```bash
make dev-server   # Redis + Go server only
make dev-client   # Next.js dev server only
make redis        # Redis only (detached)
```

### Stopping

```bash
make down    # Stop containers, keep Redis/uploads volumes
make down-v  # Stop containers and remove volumes
```
