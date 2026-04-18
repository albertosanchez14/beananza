# Beananza

A multiplayer card game inspired in the Bohnanza game design by Uwe Rosenberg.

## Running

### Prerequisites

- Docker + Docker Compose
- `make`

### 1. Localhost with Docker

Builds and starts the full stack accessible only from this machine:

```bash
make local
```

Open [http://localhost](http://localhost).

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

### Stopping

```bash
make down   # Stop and remove volumes
```
