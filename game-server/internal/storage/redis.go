package storage

import (
	"context"
	"encoding/json"
	"errors"
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
// Player authentication — long-lived auth tokens
// ----------------------------------------------------------------------------

const authTokenTTL = 30 * 24 * time.Hour // 30 days

var ErrPlayerAuthNotFound = errors.New("player auth not found")

// PlayerProfile holds the server-assigned identity for a registered player.
type PlayerProfile struct {
	PlayerID        string `json:"player_id"`
	PlayerName      string `json:"player_name"`
	AvatarURL       string `json:"avatar_url,omitempty"`
	AvatarObjectKey string `json:"avatar_object_key,omitempty"`
}

// SavePlayerAuth stores a long-lived mapping from auth_token to a player
// profile so the server can verify identity on every WebSocket message.
func (r *Repository) SavePlayerAuth(ctx context.Context, token string, profile PlayerProfile) error {
	key := playerAuthKey(token)
	data, err := json.Marshal(profile)
	if err != nil {
		return fmt.Errorf("failed to marshal player profile: %w", err)
	}
	if err := r.client.Set(ctx, key, data, authTokenTTL).Err(); err != nil {
		return fmt.Errorf("failed to save player auth: %w", err)
	}
	r.logger.Debug("player auth saved",
		zap.String("player_id", profile.PlayerID),
	)
	return nil
}

// GetPlayerByToken retrieves the player profile associated with an auth token.
// Returns nil (no error) when the token does not exist or has expired.
func (r *Repository) GetPlayerByToken(ctx context.Context, token string) (*PlayerProfile, error) {
	key := playerAuthKey(token)
	data, err := r.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // token not found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get player auth: %w", err)
	}
	var profile PlayerProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return nil, fmt.Errorf("failed to unmarshal player profile: %w", err)
	}
	return &profile, nil
}

// UpdatePlayerAvatar stores the active avatar URL and owned object key for a
// registered player. It returns the previous object key so callers can delete
// stale uploaded assets after the profile update succeeds.
func (r *Repository) UpdatePlayerAvatar(ctx context.Context, token, avatarURL, avatarObjectKey string) (string, error) {
	key := playerAuthKey(token)
	var oldObjectKey string
	var playerID string

	for attempt := 0; attempt < 3; attempt++ {
		err := r.client.Watch(ctx, func(tx *redis.Tx) error {
			data, err := tx.Get(ctx, key).Bytes()
			if err == redis.Nil {
				return ErrPlayerAuthNotFound
			}
			if err != nil {
				return fmt.Errorf("failed to get player auth: %w", err)
			}

			var profile PlayerProfile
			if err := json.Unmarshal(data, &profile); err != nil {
				return fmt.Errorf("failed to unmarshal player profile: %w", err)
			}

			ttl, err := tx.TTL(ctx, key).Result()
			if err != nil {
				return fmt.Errorf("failed to get player auth ttl: %w", err)
			}
			if ttl <= 0 {
				ttl = authTokenTTL
			}

			oldObjectKey = profile.AvatarObjectKey
			playerID = profile.PlayerID
			profile.AvatarURL = avatarURL
			profile.AvatarObjectKey = avatarObjectKey

			updatedData, err := json.Marshal(profile)
			if err != nil {
				return fmt.Errorf("failed to marshal player profile: %w", err)
			}

			_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Set(ctx, key, updatedData, ttl)
				return nil
			})
			if err != nil {
				return err
			}
			return nil
		}, key)
		if err == redis.TxFailedErr {
			continue
		}
		if err != nil {
			return "", err
		}

		r.logger.Debug("player avatar updated",
			zap.String("player_id", playerID),
			zap.String("avatar_object_key", avatarObjectKey),
		)
		return oldObjectKey, nil
	}

	return "", fmt.Errorf("failed to update player avatar after concurrent modifications")
}

func playerAuthKey(token string) string {
	return fmt.Sprintf("auth:%s", token)
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
