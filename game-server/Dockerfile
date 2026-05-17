FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /game-server ./cmd/server

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates && \
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=builder /game-server .

RUN mkdir -p /app/uploads/avatars /app/config && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

CMD ["./game-server"]
