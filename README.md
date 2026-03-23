# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

--

## Running

### Prerequisites

- Docker + Docker Compose
- `make`

---

### 1. Localhost with Docker

Builds and starts the full stack accessible only from this machine:

```bash
make local
```

Open [http://localhost](http://localhost).

---

### 2. LAN with Docker

Builds and starts the full stack accessible from any device on the same network. The setup script auto-detects your LAN IP and configures the firewall automatically.

**Linux / macOS**

```bash
make lan
```

**Windows** (Docker Desktop required — run PowerShell as Administrator):

```powershell
.\scripts\setup-lan.ps1
```

Or specify the IP manually:

```powershell
.\scripts\setup-lan.ps1 -IP 192.168.1.42
```

Or specify the IP manually on any platform:

```bash
IP=192.168.1.42 make lan        # Linux / macOS
make lan IP=192.168.1.42        # Windows
```

Open `http://<your-lan-ip>` from any device on the same Wi-Fi.

> Next.js bakes the WebSocket URL into the JS bundle at build time, so the correct IP must be provided at build time — you cannot switch between localhost and LAN without rebuilding.

To tear down the LAN configuration and stop the app:

```bash
make teardown-lan               # Linux / macOS / Windows (via make)
```

```powershell
.\scripts\teardown-lan.ps1      # Windows (PowerShell as Administrator)
```

---

### 3. Development (no Docker for app services)

Runs Redis in Docker, the Go server and Next.js dev server natively — ideal for fast iteration:

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

---

### Stopping

```bash
make down   # Stop and remove volumes
```

---

## Environment Setup

### First-time setup

```bash
cp .env.example .env
cp game-client/.env.example game-client/.env
cp game-server/.env.example game-server/.env
```

`.env` files are git-ignored. `.env.example` files are committed and serve as the reference.

---

### Root `.env` — controls Docker Compose builds

| Variable | Default     | Description                                                                                                                                            |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HOST`   | `localhost` | Hostname or LAN IP baked into the Next.js bundle at build time. `localhost` only works from this machine. Set to your LAN IP for multi-device testing. |

```bash
# localhost only (default)
HOST=localhost

# LAN / multi-device
HOST=192.168.1.42
```

> Changing `HOST` requires a rebuild (`make up-build`) because the value is compiled into the JS bundle.

---

### `game-client/.env` — controls `make dev` (local dev server)

| Variable             | Default                  | Description                                                                                              |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL for the Next.js dev server. Points directly to the Go server (port 8080), bypassing nginx. |

> This file has no effect on Docker builds. Docker builds pass `NEXT_PUBLIC_HOST` (derived from root `HOST`) so the client connects through nginx on port 80.

---

### `game-server/.env` — controls `make dev-server` (local dev server)

| Variable              | Default          | Description                                                                        |
| --------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `SERVER_HOST`         | `localhost`      | Interface the server listens on.                                                   |
| `SERVER_PORT`         | `8080`           | Port the server listens on.                                                        |
| `REDIS_ADDR`          | `localhost:6379` | Redis address.                                                                     |
| `REDIS_PASSWORD`      | _(empty)_        | Redis password, if any.                                                            |
| `REDIS_DB`            | `0`              | Redis database index.                                                              |
| `LOG_LEVEL`           | `info`           | Log verbosity (`debug`, `info`, `warn`, `error`).                                  |
| `READ_BUFFER_SIZE`    | `1024`           | WebSocket read buffer size in bytes.                                               |
| `WRITE_BUFFER_SIZE`   | `1024`           | WebSocket write buffer size in bytes.                                              |
| `WS_SEND_BUFFER_SIZE` | `256`            | Per-client outbound message buffer (number of messages).                           |
| `WS_RATE_LIMIT`       | `10`             | Sustained inbound messages/sec per client.                                         |
| `WS_RATE_BURST`       | `30`             | Burst allowance for the rate limiter.                                              |
| `ALLOWED_ORIGINS`     | _(empty)_        | Comma-separated allowed WebSocket origins. Empty = allow all (fine for local dev). |
| `CARDS_PER_TURN`      | `2`              | Cards flipped face-up during the "turn over beans" phase.                          |
| `MAX_NUMBER_PLAYERS`  | `5`              | Maximum players per room.                                                          |
| `MIN_NUMBER_PLAYERS`  | `3`              | Minimum players required to start a game.                                          |
| `CARDS_CONFIG_PATH`   | `cards.yaml`     | Path to the cards YAML config file.                                                |

> This file has no effect on Docker builds. Docker Compose sets these vars directly under each `game-server-*` service's `environment` block.

---

## Other Make Targets

```bash
make build   # Build Go server + Next.js
make test    # Run Go tests
make lint    # Lint Go + Next.js
```
