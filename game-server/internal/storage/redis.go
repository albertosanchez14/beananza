package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Repository handles all data persistence operations
type Repository struct {
	client *redis.Client
	logger *zap.Logger
}

// NewRepository creates a new Redis repository
func NewRepository(addr, password string, db int, logger *zap.Logger) (*Repository, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	logger.Info("connected to redis", zap.String("addr", addr))

	return &Repository{
		client: client,
		logger: logger,
	}, nil
}

// Close closes the Redis connection
func (r *Repository) Close() error {
	return r.client.Close()
}

// SaveMessage stores a message in Redis with a TTL
func (r *Repository) SaveMessage(ctx context.Context, roomID, messageID string, data interface{}, ttl time.Duration) error {
	key := fmt.Sprintf("room:%s:message:%s", roomID, messageID)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	if err := r.client.Set(ctx, key, jsonData, ttl).Err(); err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}

	r.logger.Debug("message saved",
		zap.String("room_id", roomID),
		zap.String("message_id", messageID),
	)

	return nil
}

// GetMessage retrieves a message from Redis
func (r *Repository) GetMessage(ctx context.Context, roomID, messageID string, dest interface{}) error {
	key := fmt.Sprintf("room:%s:message:%s", roomID, messageID)

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("message not found")
		}
		return fmt.Errorf("failed to get message: %w", err)
	}

	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}

	return nil
}

// SaveGameState stores the current game state for a room
func (r *Repository) SaveGameState(ctx context.Context, roomID string, state interface{}) error {
	key := fmt.Sprintf("room:%s:state", roomID)

	jsonData, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	if err := r.client.Set(ctx, key, jsonData, 24*time.Hour).Err(); err != nil {
		return fmt.Errorf("failed to save state: %w", err)
	}

	r.logger.Debug("game state saved", zap.String("room_id", roomID))

	return nil
}

// GetGameState retrieves the game state for a room
func (r *Repository) GetGameState(ctx context.Context, roomID string, dest interface{}) error {
	key := fmt.Sprintf("room:%s:state", roomID)

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("game state not found")
		}
		return fmt.Errorf("failed to get state: %w", err)
	}

	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("failed to unmarshal state: %w", err)
	}

	return nil
}

// AddPlayerToRoom adds a player to a room's player list
func (r *Repository) AddPlayerToRoom(ctx context.Context, roomID, playerID string) error {
	key := fmt.Sprintf("room:%s:players", roomID)

	if err := r.client.SAdd(ctx, key, playerID).Err(); err != nil {
		return fmt.Errorf("failed to add player to room: %w", err)
	}

	// Set expiry
	r.client.Expire(ctx, key, 24*time.Hour)

	r.logger.Debug("player added to room",
		zap.String("room_id", roomID),
		zap.String("player_id", playerID),
	)

	return nil
}

// RemovePlayerFromRoom removes a player from a room's player list
func (r *Repository) RemovePlayerFromRoom(ctx context.Context, roomID, playerID string) error {
	key := fmt.Sprintf("room:%s:players", roomID)

	if err := r.client.SRem(ctx, key, playerID).Err(); err != nil {
		return fmt.Errorf("failed to remove player from room: %w", err)
	}

	r.logger.Debug("player removed from room",
		zap.String("room_id", roomID),
		zap.String("player_id", playerID),
	)

	return nil
}

// GetRoomPlayers gets all players in a room
func (r *Repository) GetRoomPlayers(ctx context.Context, roomID string) ([]string, error) {
	key := fmt.Sprintf("room:%s:players", roomID)

	players, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get room players: %w", err)
	}

	return players, nil
}
