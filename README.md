# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

## Running

### Prerequisites

- Docker + Docker Compose
- `make`

### 1. Local/Dev with Docker Compose

Builds local client and server images, then runs nginx, Redis, one static Vite
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
AVATAR_UPLOAD_PREFIX=avatars
S3_BUCKET=beananza-uploads
S3_REGION=fra1
S3_ENDPOINT=https://fra1.digitaloceanspaces.com
S3_ACCESS_KEY_ID=your-spaces-key
S3_SECRET_ACCESS_KEY=your-spaces-secret
S3_PUBLIC_BASE_URL=https://beananza-uploads.fra1.digitaloceanspaces.com
S3_ACL=public-read
HTTP_PORT=80
HTTPS_PORT=443
```

`REDIS_DB` must be a numeric Redis database index. Use `0` unless you have a
specific reason to separate multiple apps in the same Redis instance.

Uploaded assets use local Docker volume storage in the base/dev Compose setup.
The production override sets `STORAGE_BACKEND=s3`; point the S3 settings at
DigitalOcean Spaces or another S3-compatible provider. The current client
uploads avatars to `/upload-avatar`; the server stores them under
`AVATAR_UPLOAD_PREFIX` and returns the public object URL.

Game rules and card definitions are configured in `./game-server/game.yaml`.
The file is not baked into the server image; Compose mounts it read-only to
`/app/config/game.yaml` inside each server container:

```yaml
cards_per_turn: 2
max_number_players: 5
min_number_players: 3
max_reshuffles: 3
cards_per_draw: 3

cards:
  - name: "Judicultor"
    count: 6
```

### 3. Development

Runs Redis in Docker, then runs the Go server and Vite dev server natively:

```bash
make dev
```

- Vite dev server: [http://localhost:3000](http://localhost:3000)
- Game server API: [http://localhost:8080](http://localhost:8080)

Individual targets:

```bash
make dev-server   # Redis + Go server only
make dev-client   # Vite dev server only
make redis        # Redis only (detached)
```

### 4. Local S3-Compatible Storage

Use MinIO to test the S3 object-storage path without DigitalOcean Spaces:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.s3-local.yml \
  up -d --build
```

Register a test player, then upload a bundled avatar through the real app
endpoint using the returned `auth_token`:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -d '{"name":"Storage Tester"}' \
  http://localhost/register

curl -i \
  -H "Authorization: Bearer <auth_token>" \
  -F "avatar=@game-client/public/avatars/bandit.webp" \
  http://localhost/upload-avatar
```

The response URL should point at MinIO, for example
`http://localhost:9000/beananza-uploads/avatars/<uuid>.webp`. Fetch it to
confirm the object is public:

```bash
curl -I "http://localhost:9000/beananza-uploads/avatars/<uuid>.webp"
```

MinIO console: [http://localhost:9001](http://localhost:9001), login
`minioadmin` / `minioadmin`.

List stored objects from the MinIO client container:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.s3-local.yml \
  run --rm --entrypoint /bin/sh minio-create-bucket \
  -c 'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc ls --recursive "local/$S3_BUCKET"'
```

Upload a second avatar with the same auth token to test replacement cleanup.
After the second upload, listing MinIO should show only the new object for that
player; the previous uploaded avatar key is removed after Redis is updated.

Stop the local S3 test stack:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.s3-local.yml \
  down
```

### Stopping

```bash
make down    # Stop containers, keep Redis/uploads volumes
make down-v  # Stop containers and remove volumes
```
