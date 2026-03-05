package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Repository struct {
	client *redis.Client
	logger *zap.Logger
}

func NewRepository(addr, password string, db int, logger *zap.Logger) (*Repository, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

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

func (r *Repository) Close() error {
	return r.client.Close()
}

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

func (r *Repository) GetRoomPlayers(ctx context.Context, roomID string) ([]string, error) {
	key := fmt.Sprintf("room:%s:players", roomID)

	players, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get room players: %w", err)
	}

	return players, nil
}

func (r *Repository) SaveWaitingLobby(ctx context.Context, roomID string, lobby interface{}) error {
	key := fmt.Sprintf("room:%s:lobby", roomID)

	data, err := json.Marshal(lobby)
	if err != nil {
		return fmt.Errorf("failed to marshal waiting lobby: %w", err)
	}

	if err := r.client.Set(ctx, key, data, 24*time.Hour).Err(); err != nil {
		return fmt.Errorf("failed to save waiting lobby: %w", err)
	}

	r.logger.Debug("waiting lobby saved", zap.String("room_id", roomID))
	return nil
}

func (r *Repository) GetWaitingLobby(ctx context.Context, roomID string, dest interface{}) error {
	key := fmt.Sprintf("room:%s:lobby", roomID)

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("waiting lobby not found")
		}
		return fmt.Errorf("failed to get waiting lobby: %w", err)
	}

	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("failed to unmarshal waiting lobby: %w", err)
	}

	return nil
}

// RoomMeta is the per-room data stored in the global room registry.
type RoomMeta struct {
	ID           string `json:"id"`
	PlayerCount  int    `json:"player_count"`
	MaxPlayers   int    `json:"max_players"`
	SessionState string `json:"session_state"`
}

const roomsRegistryKey = "rooms:registry"

// UpsertRoomInfo writes or updates a room's metadata in the shared registry.
func (r *Repository) UpsertRoomInfo(ctx context.Context, info RoomMeta) error {
	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("failed to marshal room info: %w", err)
	}

	if err := r.client.HSet(ctx, roomsRegistryKey, info.ID, data).Err(); err != nil {
		return fmt.Errorf("failed to upsert room info: %w", err)
	}

	r.client.Expire(ctx, roomsRegistryKey, 24*time.Hour)

	r.logger.Debug("room info upserted", zap.String("room_id", info.ID))
	return nil
}

// DeleteRoomInfo removes a room from the shared registry.
func (r *Repository) DeleteRoomInfo(ctx context.Context, roomID string) error {
	if err := r.client.HDel(ctx, roomsRegistryKey, roomID).Err(); err != nil {
		return fmt.Errorf("failed to delete room info: %w", err)
	}

	r.logger.Debug("room info deleted", zap.String("room_id", roomID))
	return nil
}

// GetAllRooms returns all rooms from the shared registry.
func (r *Repository) GetAllRooms(ctx context.Context) ([]RoomMeta, error) {
	entries, err := r.client.HGetAll(ctx, roomsRegistryKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get all rooms: %w", err)
	}

	rooms := make([]RoomMeta, 0, len(entries))
	for _, v := range entries {
		var meta RoomMeta
		if err := json.Unmarshal([]byte(v), &meta); err != nil {
			r.logger.Warn("failed to unmarshal room meta, skipping", zap.Error(err))
			continue
		}
		rooms = append(rooms, meta)
	}

	return rooms, nil
}

// ----------------------------------------------------------------------------
// Session tokens — used for reconnection support
// ----------------------------------------------------------------------------

const sessionTokenTTL = 30 * time.Minute

// SaveSessionToken stores a mapping from a random token to a player ID so the
// player can reconnect to their in-progress session after a disconnect.
// The token expires after sessionTokenTTL (30 minutes).
func (r *Repository) SaveSessionToken(ctx context.Context, token, playerID string) error {
	key := fmt.Sprintf("session:%s", token)
	if err := r.client.Set(ctx, key, playerID, sessionTokenTTL).Err(); err != nil {
		return fmt.Errorf("failed to save session token: %w", err)
	}
	r.logger.Debug("session token saved",
		zap.String("player_id", playerID),
	)
	return nil
}

// GetSessionToken retrieves the player ID associated with a token.
// Returns an empty string and no error when the token is not found.
func (r *Repository) GetSessionToken(ctx context.Context, token string) (string, error) {
	key := fmt.Sprintf("session:%s", token)
	playerID, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil // token not found — treat as expired
	}
	if err != nil {
		return "", fmt.Errorf("failed to get session token: %w", err)
	}
	return playerID, nil
}
