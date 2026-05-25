# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

## Running

### Prerequisites

- Docker + Docker Compose

### 1. Local/Dev with Docker Compose

Builds local client, server, and nginx gateway images, then runs nginx, Redis,
one static Vite client, and the Go server over HTTP.

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

Or use the Makefile shortcut:

```bash
make up-d
```

Open [http://localhost](http://localhost).

### 2. Production with Docker Compose

`docker-compose.yml` uses prebuilt client and server images. Use the prod
override for an HTTPS deployment on port 443:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The prod override enables TLS in the shared nginx template, mounts
`./nginx/certs`, and expects certificates at:

```text
./nginx/certs/fullchain.crt
./nginx/certs/privkey.pem
```

Both Compose deploys use a same-origin routing model: the client, API, and
WebSocket endpoint are served from the same origin. Local/dev uses HTTP; prod
uses HTTPS. The browser calls `/rooms`, `/register`, `/config`,
`/upload-avatar`, `/beananza-uploads`, and `/ws` directly.

### 3. Shared nginx gateway

The nginx gateway image is built from `nginx/Dockerfile`. It packages
`nginx/nginx.conf.template`, which is the single gateway config used by
Railway and Docker Compose. Compose builds the same image locally and switches
behavior through environment variables:

```env
PORT=80
NGINX_FORWARDED_PROTO=http
NGINX_ENABLE_SSL=false
```

For the prod Compose override, `PORT=443`, `NGINX_ENABLE_SSL=true`, and
`NGINX_FORWARDED_PROTO=https`.

For Railway, the container still listens on Railway's `PORT` over plain HTTP
because Railway terminates HTTPS at the platform edge. The image defaults
`NGINX_FORWARDED_PROTO` to `https` for that deployment shape.

If the nginx service is built directly from this repository in Railway, set
`RAILWAY_DOCKERFILE_PATH` to:

```text
nginx/Dockerfile
```

Docker Compose sets upstreams to the Compose service names. For Railway private
networking, override them with the Railway service hostnames:

```env
GAME_SERVER_HOST=game-server.railway.internal
GAME_SERVER_PORT=8080
GAME_CLIENT_HOST=game-client.railway.internal
GAME_CLIENT_PORT=3000
OBJECT_STORAGE_HOST=minio.railway.internal
OBJECT_STORAGE_PORT=9000
```

Server defaults are set directly in `docker-compose.yml` and the Compose
overrides. Create a local `.env` for secrets only:

```bash
cp .env.example .env
```

The supported `.env` values are:

```env
REDIS_URL=redis://redis:6379
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_SESSION_TOKEN=
```

Redis is configured with `REDIS_URL` and the server fails to start if it is not
set. Use `redis://redis:6379` for Docker Compose and `redis://localhost:6379`
for a native Go server using the local Compose Redis. Leave `S3_SESSION_TOKEN`
empty unless the object-storage provider requires one.

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
