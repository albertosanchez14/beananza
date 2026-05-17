-include .env
PORT ?= 80
HTTP_PORT ?= $(PORT)
HTTPS_PORT ?= 443

.PHONY: help local lan teardown-lan up up-d prod prod-d down down-v restart logs ps redis dev dev-server dev-client build test lint

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

# ── Run ───────────────────────────────────────────────────────────────────────

local:
	HTTP_PORT=$(HTTP_PORT) docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev: 
	@echo "Starting Redis..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up redis -d
	@echo "Starting Go server and Next.js dev server (Ctrl+C to stop both)..."
	@trap 'kill 0' INT; \
		$(MAKE) -C game-server run & \
		npm run dev --prefix game-client & \
		wait

# ── Docker: manage ───────────────────────────────────────────────────────────

up: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

up-d: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

down: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml down

down-v:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml down -v

restart: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml restart

logs: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

ps: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

redis: 
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up redis -d

# ── Dev: individual services ─────────────────────────────────────────────────

dev-server:
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up redis -d
	@$(MAKE) -C game-server run

dev-client: 
	npm run dev --prefix game-client

# ── Build / test / lint ──────────────────────────────────────────────────────

install:
	$(MAKE) -C game-client install 

build:
	$(MAKE) -C game-server build
	$(MAKE) -C game-client build

test: 
	$(MAKE) -C game-server test

lint:
	$(MAKE) -C game-server lint
	npm run lint --prefix game-client
