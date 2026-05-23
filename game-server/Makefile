-include ../.env

.PHONY: build run test clean deps docker-build docker-tag docker-push 

BIN_DIR=bin
BINARY_NAME=$(BIN_DIR)/beananza-server
MAIN_PATH=./cmd/server
GO=go

REGISTRY ?= ghcr.io/albertosanchez14
VERSION_TAG ?= $(if $(APP_TAG),$(APP_TAG),latest)

IMAGE_NAME ?= beananza-server
IMAGE_REGISTRY := $(patsubst %/,%,$(REGISTRY))
LOCAL_IMAGE := $(IMAGE_NAME):$(VERSION_TAG)
REMOTE_IMAGE := $(IMAGE_REGISTRY)/$(IMAGE_NAME):$(VERSION_TAG)

deps: 
	$(GO) mod download
	$(GO) mod tidy

build: 
	@mkdir -p $(BIN_DIR)
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
	docker build --no-cache -t $(LOCAL_IMAGE) .

docker-tag: docker-build
	docker tag $(LOCAL_IMAGE) $(REMOTE_IMAGE)

docker-push: docker-tag
	docker push $(REMOTE_IMAGE)

