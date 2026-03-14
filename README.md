# Card Game

A multiplayer card game built with Go, Next.js, Redis, and nginx.

## Architecture

```
Browser(s)
    │
    ▼
nginx :80
    ├── /ws, /rooms, /register, /config  →  game-server-1 / game-server-2 (Go, :8080)
    └── /                                →  game-client (Next.js, :3000)
                                                  │
                                              Redis :6379
```

nginx uses `ip_hash` for upstream load balancing so WebSocket reconnects always land on the same game-server instance.

---

## Running with Docker Compose

### Prerequisites

- Docker + Docker Compose
- `make`

### Quick start (localhost only)

```bash
make up-build
```

Open [http://localhost](http://localhost).

To stop and remove volumes:

```bash
make down
```

---

## Multi-Device / LAN Testing

Next.js bakes the WebSocket URL into the JS bundle at build time. The default `localhost` only works from the machine running Docker. To test from other devices (phones, laptops) on the same network, you need to build with your machine's LAN IP.

### On Linux / macOS

**1. Find your LAN IP**

```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# or on macOS:
ipconfig getifaddr en0
```

Use the IP of your Wi-Fi or Ethernet interface (e.g. `192.168.1.42`).

**2. Set HOST in `.env`**

```bash
# .env (root of the project)
HOST=192.168.1.42
```

**3. Rebuild and start**

```bash
make up-build
```

**4. Open from any device on the same Wi-Fi**

```
http://192.168.1.42
```

---

### On WSL2 (Windows)

WSL2 runs inside a virtual network, so you need to forward the port from Windows to WSL2.

**1. Find your Windows LAN IP**

In a Windows terminal (cmd or PowerShell):

```
ipconfig
```

Look for your Wi-Fi or Ethernet adapter IPv4 address (e.g. `192.168.1.42`).

**2. Find your WSL2 internal IP**

In WSL:

```bash
ip addr show eth0 | grep "inet "
# e.g. inet 172.21.151.21/20
```

**3. Forward port 80 from Windows to WSL2**

In PowerShell **as Administrator**:

```powershell
netsh interface portproxy add v4tov4 `
  listenport=80 listenaddress=0.0.0.0 `
  connectport=80 connectaddress=<WSL2-IP>
```

**4. Allow port 80 through Windows Firewall**

Also as Administrator:

```powershell
New-NetFirewallRule -DisplayName "WSL2 port 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

**5. Set HOST and rebuild**

```bash
# .env
HOST=192.168.1.42   # Windows LAN IP
```

```bash
make up-build
```

**6. Open from any device on the same Wi-Fi**

```
http://192.168.1.42
```

**To remove the port forwarding rule when done:**

```powershell
netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0
```

---

## Local Development (no Docker)

Runs Redis in Docker, the Go server and Next.js dev server natively:

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

| Variable | Default     | Description |
| -------- | ----------- | ----------- |
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

| Variable             | Default                  | Description |
| -------------------- | ------------------------ | ----------- |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL for the Next.js dev server. Points directly to the Go server (port 8080), bypassing nginx. |

> This file has no effect on Docker builds. Docker builds pass `NEXT_PUBLIC_HOST` (derived from root `HOST`) so the client connects through nginx on port 80.

---

### `game-server/.env` — controls `make dev-server` (local dev server)

| Variable            | Default          | Description |
| ------------------- | ---------------- | ----------- |
| `SERVER_HOST`       | `localhost`      | Interface the server listens on. |
| `SERVER_PORT`       | `8080`           | Port the server listens on. |
| `REDIS_ADDR`        | `localhost:6379` | Redis address. |
| `REDIS_PASSWORD`    | _(empty)_        | Redis password, if any. |
| `REDIS_DB`          | `0`              | Redis database index. |
| `LOG_LEVEL`         | `info`           | Log verbosity (`debug`, `info`, `warn`, `error`). |
| `READ_BUFFER_SIZE`  | `1024`           | WebSocket read buffer size in bytes. |
| `WRITE_BUFFER_SIZE` | `1024`           | WebSocket write buffer size in bytes. |
| `WS_SEND_BUFFER_SIZE` | `256`          | Per-client outbound message buffer (number of messages). |
| `WS_RATE_LIMIT`     | `10`             | Sustained inbound messages/sec per client. |
| `WS_RATE_BURST`     | `30`             | Burst allowance for the rate limiter. |
| `ALLOWED_ORIGINS`   | _(empty)_        | Comma-separated allowed WebSocket origins. Empty = allow all (fine for local dev). |
| `CARDS_PER_TURN`    | `2`              | Cards flipped face-up during the "turn over beans" phase. |
| `MAX_NUMBER_PLAYERS` | `5`             | Maximum players per room. |
| `MIN_NUMBER_PLAYERS` | `3`             | Minimum players required to start a game. |
| `CARDS_CONFIG_PATH` | `cards.yaml`     | Path to the cards YAML config file. |

> This file has no effect on Docker builds. Docker Compose sets these vars directly under each `game-server-*` service's `environment` block.

---

## Other Make Targets

```bash
make build   # Build Go server + Next.js
make test    # Run Go tests
make lint    # Lint Go + Next.js
```
