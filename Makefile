-include .env

.PHONY: help local lan teardown-lan up up-d up-build prod down down-v restart logs ps redis dev dev-server dev-client build test lint

# ── Run ───────────────────────────────────────────────────────────────────────

dev: 
	@echo "Starting Redis..."
	@docker compose -f docker-compose.yml -f docker-compose.local.yml up redis -d
	@echo "Starting Go server and Vite dev server (Ctrl+C to stop both)..."
	@trap 'kill 0' INT; \
		$(MAKE) -C game-server run & \
		npm run dev --prefix game-client & \
		wait

# ── Docker: manage ───────────────────────────────────────────────────────────

up: 
	HTTP_PORT=$(HTTP_PORT) docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.s3-local.yml  up

up-d: 
	HTTP_PORT=$(HTTP_PORT) docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.s3-local.yml up -d

up-build:
	HTTP_PORT=$(HTTP_PORT) docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.s3-local.yml up -d --build

prod: 
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

down: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.prod.yml -f docker-compose.s3-local.yml down

down-v:
	docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.prod.yml -f docker-compose.s3-local.yml down -v

restart: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml restart

logs: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f

ps: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml ps

redis: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml up redis -d

# ── Dev: individual services ─────────────────────────────────────────────────

dev-server:
	@docker compose -f docker-compose.yml -f docker-compose.local.yml up redis -d
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
