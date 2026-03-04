FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /game-server ./cmd/server

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /game-server .

EXPOSE 8080

ENV REDIS_ADDR=redis:6379
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

CMD ["./game-server"]
