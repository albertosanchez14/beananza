.PHONY: help build run test clean deps redis-up redis-down

# Variables
BINARY_NAME=game-server
MAIN_PATH=./cmd/server
GO=go

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Download dependencies
	$(GO) mod download
	$(GO) mod tidy

build: ## Build the application
	$(GO) build -o $(BINARY_NAME) $(MAIN_PATH)

run: ## Run the application
	$(GO) run $(MAIN_PATH)/main.go

dev: ## Run with hot reload (requires air: go install github.com/cosmtrek/air@latest)
	air

test: ## Run tests
	$(GO) test -v ./...

test-coverage: ## Run tests with coverage
	$(GO) test -v -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

clean: ## Clean build artifacts
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	$(GO) clean

fmt: ## Format code
	$(GO) fmt ./...

lint: ## Run linter (requires golangci-lint)
	golangci-lint run

redis-up: ## Start Redis using Docker
	docker run -d --name game-server-redis -p 6379:6379 redis:7-alpine

redis-down: ## Stop Redis container
	docker stop game-server-redis
	docker rm game-server-redis

redis-cli: ## Connect to Redis CLI
	docker exec -it game-server-redis redis-cli

docker-build: ## Build Docker image
	docker build -t game-server:latest .

docker-run: ## Run Docker container
	docker run -p 8080:8080 --env-file .env game-server:latest

.DEFAULT_GOAL := help
