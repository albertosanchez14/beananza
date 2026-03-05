.PHONY: help up up-build down redis dev dev-server dev-client build test lint

WS_URL=ws://localhost:8080/ws

up:
	docker compose up

up-build: 
	docker compose up --build

down: 
	docker compose down -v

redis: 
	docker compose up redis -d

dev: 
	@echo "Starting Redis..."
	@docker compose up redis -d
	@echo "Starting Go server and Next.js dev server (Ctrl+C to stop both)..."
	@trap 'kill 0' INT; \
		$(MAKE) -C game-server run & \
		NEXT_PUBLIC_WS_URL=$(WS_URL) npm run dev --prefix game-client & \
		wait

dev-server: 
	@docker compose up redis -d
	@$(MAKE) -C game-server run

dev-client:
	NEXT_PUBLIC_WS_URL=$(WS_URL) npm run dev --prefix game-client

build:
	$(MAKE) -C game-server build
	npm run build --prefix game-client

test: 
	$(MAKE) -C game-server test

lint: 
	$(MAKE) -C game-server lint
	npm run lint --prefix game-client
