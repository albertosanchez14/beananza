package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type PubSub struct {
	client *redis.Client
	logger *zap.Logger
	ctx    context.Context
	cancel context.CancelFunc

	subs       map[string]*redis.PubSub
	handlers   map[string]func(roomID string, message []byte)
	handlersMu sync.RWMutex

	mu sync.Mutex
}

func NewPubSub(redisURL string, logger *zap.Logger) (*PubSub, error) {
	client, addr, err := newRedisClient(redisURL)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

	if err := client.Ping(ctx).Err(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to connect to redis for pub/sub: %w", err)
	}

	logger.Info("redis pub/sub connected", zap.String("addr", addr))

	cancel()

	ctx, cancel = context.WithCancel(context.Background())

	return &PubSub{
		client:   client,
		logger:   logger,
		ctx:      ctx,
		cancel:   cancel,
		subs:     make(map[string]*redis.PubSub),
		handlers: make(map[string]func(roomID string, message []byte)),
	}, nil
}

func (p *PubSub) Close() error {
	p.cancel()
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, sub := range p.subs {
		sub.Close()
	}
	return p.client.Close()
}

func (p *PubSub) Subscribe(roomID string, handler func(roomID string, message []byte)) error {
	channel := fmt.Sprintf("room:%s", roomID)

	p.mu.Lock()
	if _, ok := p.subs[roomID]; ok {
		p.mu.Unlock()
		p.logger.Debug("already subscribed to room", zap.String("room_id", roomID))
		return nil
	}

	p.handlersMu.Lock()
	p.handlers[roomID] = handler
	p.handlersMu.Unlock()

	sub := p.client.Subscribe(p.ctx, channel)
	p.subs[roomID] = sub
	p.mu.Unlock()

	// Wait for Redis to confirm the subscription before returning.
	// This prevents a race where a Publish fires before the server
	// is actually subscribed and the message is silently dropped.
	if _, err := sub.Receive(p.ctx); err != nil {
		p.mu.Lock()
		delete(p.subs, roomID)
		p.mu.Unlock()

		p.handlersMu.Lock()
		delete(p.handlers, roomID)
		p.handlersMu.Unlock()

		return fmt.Errorf("failed to confirm subscription for room %s: %w", roomID, err)
	}

	go p.listen(roomID, sub)

	p.logger.Info("subscribed to room channel",
		zap.String("room_id", roomID),
		zap.String("channel", channel),
	)

	return nil
}

func (p *PubSub) Unsubscribe(roomID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	sub, ok := p.subs[roomID]
	if !ok {
		p.logger.Debug("not subscribed to room", zap.String("room_id", roomID))
		return nil
	}

	sub.Close()
	delete(p.subs, roomID)

	p.handlersMu.Lock()
	delete(p.handlers, roomID)
	p.handlersMu.Unlock()

	p.logger.Info("unsubscribed from room channel",
		zap.String("room_id", roomID),
	)

	return nil
}

func (p *PubSub) Publish(roomID string, message []byte) error {
	channel := fmt.Sprintf("room:%s", roomID)

	if err := p.client.Publish(p.ctx, channel, message).Err(); err != nil {
		p.logger.Error("failed to publish message",
			zap.String("room_id", roomID),
			zap.String("channel", channel),
			zap.Error(err),
		)
		return err
	}

	p.logger.Debug("published message to room",
		zap.String("room_id", roomID),
		zap.Int("message_len", len(message)),
	)

	return nil
}

func (p *PubSub) listen(roomID string, sub *redis.PubSub) {
	ch := sub.Channel()

	for {
		select {
		case <-p.ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}

			p.handlersMu.RLock()
			handler, ok := p.handlers[roomID]
			p.handlersMu.RUnlock()

			if ok && handler != nil {
				handler(roomID, []byte(msg.Payload))
			}
		}
	}
}
