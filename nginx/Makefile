-include ../.env

REGISTRY ?= ghcr.io/albertosanchez14
VERSION_TAG ?= $(if $(APP_TAG),$(APP_TAG),latest)

IMAGE_NAME ?= beananza-nginx
IMAGE_REGISTRY := $(patsubst %/,%,$(REGISTRY))
LOCAL_IMAGE := $(IMAGE_NAME):$(VERSION_TAG)
REMOTE_IMAGE := $(IMAGE_REGISTRY)/$(IMAGE_NAME):$(VERSION_TAG)

.PHONY: docker-build docker-tag docker-push

docker-build:
	docker build --no-cache -t $(LOCAL_IMAGE) .

docker-tag: docker-build
	docker tag $(LOCAL_IMAGE) $(REMOTE_IMAGE)

docker-push: docker-tag
	docker push $(REMOTE_IMAGE)
