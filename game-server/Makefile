.PHONY: help build run test clean deps redis-up redis-down

BINARY_NAME=game-server
MAIN_PATH=./cmd/server
GO=go

help: 
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: 
	$(GO) mod download
	$(GO) mod tidy

build: 
	$(GO) build -o $(BINARY_NAME) $(MAIN_PATH)

run:
	$(GO) run $(MAIN_PATH)/main.go

dev: 
	air

test: 
	$(GO) test -v ./...

test-coverage:
	$(GO) test -v -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

clean:
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	$(GO) clean

fmt:
	$(GO) fmt ./...

lint: 
	golangci-lint run

docker-build: 
	docker build -t game-server:latest .

docker-run:
	docker run -p 8080:8080 --env-file .env game-server:latest

.DEFAULT_GOAL := help
