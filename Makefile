-include .env
PORT ?= 80

.PHONY: help local lan teardown-lan up up-d down restart logs ps redis dev dev-server dev-client build test lint

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

# ── Run ───────────────────────────────────────────────────────────────────────

local: ## Build and run for localhost
	APP_HOST=localhost:$(PORT) PORT=$(PORT) docker compose up --build

ifeq ($(OS),Windows_NT)
lan: ## Build and run for LAN — auto-detects IP
	powershell.exe -ExecutionPolicy Bypass -File scripts\setup-lan.ps1 $(if $(IP),-IP $(IP),) -Port $(PORT)
else
lan: ## Build and run for LAN — auto-detects IP
	@IP="$(IP)" PORT="$(PORT)" bash scripts/setup-lan.sh
endif

dev: ## Run Redis in Docker + Go server + Next.js dev
	@echo "Starting Redis..."
	@docker compose up redis -d
	@echo "Starting Go server and Next.js dev server (Ctrl+C to stop both)..."
	@trap 'kill 0' INT; \
		$(MAKE) -C game-server run & \
		npm run dev --prefix game-client & \
		wait

# ── Docker: manage ───────────────────────────────────────────────────────────

ifeq ($(OS),Windows_NT)
teardown-lan: ## Remove LAN firewall rules / portproxy
	powershell.exe -ExecutionPolicy Bypass -File scripts\teardown-lan.ps1
else
teardown-lan: ## Remove LAN firewall rules / portproxy
	@TEARDOWN=true PORT="$(PORT)" bash scripts/setup-lan.sh
endif

up: ## Start without rebuilding
	docker compose up

up-d: ## Start without rebuilding (detached)
	docker compose up -d

down: ## Stop and remove volumes
	docker compose down -v

restart: ## Restart all services
	docker compose restart

logs: ## Follow logs for all services
	docker compose logs -f

ps: ## Show running containers
	docker compose ps

redis: ## Start only Redis (detached)
	docker compose up redis -d

# ── Dev: individual services ─────────────────────────────────────────────────

dev-server:
	@docker compose up redis -d
	@$(MAKE) -C game-server run

dev-client: 
	npm run dev --prefix game-client

# ── Build / test / lint ──────────────────────────────────────────────────────

build:
	$(MAKE) -C game-server build
	npm run build --prefix game-client
	docker build game-client --file game-client/Dockerfile --tag game-client:latest

test: 
	$(MAKE) -C game-server test

lint:
	$(MAKE) -C game-server lint
	npm run lint --prefix game-client
