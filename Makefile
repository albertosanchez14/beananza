-include .env

REGISTRY ?= ghcr.io/albertosanchez14
VERSION_TAG ?= $(if $(APP_TAG),$(APP_TAG),latest)

.PHONY: help up up-d up-build down down-v restart logs ps redis dev dev-server dev-client install build test lint docker-build docker-build-client docker-build-server docker-build-nginx docker-tag docker-tag-client docker-tag-server docker-tag-nginx docker-push docker-push-client docker-push-server docker-push-nginx

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
	docker compose -f docker-compose.yml -f docker-compose.local.yml up

up-d: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

up-build:
	docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

down: 
	docker compose -f docker-compose.yml -f docker-compose.local.yml down

down-v:
	docker compose -f docker-compose.yml -f docker-compose.local.yml down -v

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
	$(MAKE) docker-build-server 
	$(MAKE) -C game-client build
	$(MAKE) docker-build-client
	$(MAKE) docker-build-nginx
	
test: 
	$(MAKE) -C game-server test

lint:
	$(MAKE) -C game-server lint
	npm run lint --prefix game-client

# ── Docker: images ───────────────────────────────────────────────────────────

docker-build: docker-build-client docker-build-server docker-build-nginx

docker-build-client:
	$(MAKE) -C game-client docker-build REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-build-server:
	$(MAKE) -C game-server docker-build REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-build-nginx:
	$(MAKE) -C nginx docker-build REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-tag: docker-tag-client docker-tag-server docker-tag-nginx

docker-tag-client:
	$(MAKE) -C game-client docker-tag REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-tag-server:
	$(MAKE) -C game-server docker-tag REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-tag-nginx:
	$(MAKE) -C nginx docker-tag REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-push: docker-push-client docker-push-server docker-push-nginx

docker-push-client:
	$(MAKE) -C game-client docker-push REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-push-server:
	$(MAKE) -C game-server docker-push REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"

docker-push-nginx:
	$(MAKE) -C nginx docker-push REGISTRY="$(REGISTRY)" VERSION_TAG="$(VERSION_TAG)"
