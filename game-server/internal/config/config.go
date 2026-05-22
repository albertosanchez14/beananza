package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Server  ServerConfig
	Redis   RedisConfig
	Logger  LoggerConfig
	WS      WebSocketConfig
	Game    GameConfig
	Storage StorageConfig
}

type ServerConfig struct {
	Host string
	Port string
	// AllowedOrigins is the list of permitted WebSocket / CORS origins.
	// An empty slice disables the check (useful for local dev).
	// Set via ALLOWED_ORIGINS as a comma-separated list, e.g.
	//   ALLOWED_ORIGINS=https://mygame.example.com,https://www.mygame.example.com
	AllowedOrigins []string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type StorageConfig struct {
	Backend              string
	MaxAvatarUploadBytes int64
	AvatarUploadPrefix   string
	LocalObjectDir       string
	LocalPublicBaseURL   string
	S3Bucket             string
	S3Region             string
	S3Endpoint           string
	S3AccessKeyID        string
	S3SecretAccessKey    string
	S3PublicBaseURL      string
	S3ForcePathStyle     bool
	S3ACL                string
}

type LoggerConfig struct {
	Level string
}

type WebSocketConfig struct {
	ReadBufferSize  int
	WriteBufferSize int
	// SendBufferSize is the number of messages that can be queued per client
	// before the connection is considered slow and the message is dropped.
	// Configurable via WS_SEND_BUFFER_SIZE (default 256).
	SendBufferSize int
	// RateLimit is the sustained messages-per-second allowed per client.
	// Configurable via WS_RATE_LIMIT (default 10).
	RateLimit int
	// RateBurst is the maximum burst size for the per-client rate limiter.
	// Configurable via WS_RATE_BURST (default 20).
	RateBurst int
}

type GameConfig struct {
	MaxNumberPlayers int
	MinNumberPlayers int
	CardsPerTurn     int
	MaxReshuffles    int
	CardsPerDraw     int
	Cards            CardsConfig
	// LobbyResetSecs is the number of seconds after a game ends before the room
	// automatically resets to the waiting lobby. Configurable via LOBBY_RESET_SECS (default 30).
	LobbyResetSecs int
	// DisconnectTimeoutSecs is the number of seconds the server waits before
	// skipping a disconnected player's turn (or ending the game if too few
	// players are connected).  Configurable via DISCONNECT_TIMEOUT_SECS (default 60).
	DisconnectTimeoutSecs int
}

type GameFileConfig struct {
	CardsPerTurn     int              `yaml:"cards_per_turn"`
	MaxNumberPlayers int              `yaml:"max_number_players"`
	MinNumberPlayers int              `yaml:"min_number_players"`
	MaxReshuffles    int              `yaml:"max_reshuffles"`
	CardsPerDraw     int              `yaml:"cards_per_draw"`
	Cards            []CardTypeConfig `yaml:"cards"`
}

type CardsConfig struct {
	CardTypes []CardTypeConfig
}

type CardTypeConfig struct {
	Name          string      `yaml:"name"           json:"name"`
	Count         int         `yaml:"count"          json:"count"`
	FrontImage    string      `yaml:"front_image"    json:"front_image"`
	BackImage     string      `yaml:"back_image"     json:"back_image"`
	ExchangeRates map[int]int `yaml:"exchange_rates" json:"exchange_rates"`
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	gameConfigPath := getGameConfigPath()
	gameFile, err := LoadGameFile(gameConfigPath)
	if err != nil {
		log.Fatalf("failed to load game config: %v", err)
	}

	return &Config{
		Server: ServerConfig{
			Host:           getEnv("SERVER_HOST", "localhost"),
			Port:           getEnv("SERVER_PORT", "8080"),
			AllowedOrigins: getEnvAsStringSlice("ALLOWED_ORIGINS"),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		Logger: LoggerConfig{
			Level: getEnv("LOG_LEVEL", "info"),
		},
		WS: WebSocketConfig{
			ReadBufferSize:  getEnvAsInt("READ_BUFFER_SIZE", 1024),
			WriteBufferSize: getEnvAsInt("WRITE_BUFFER_SIZE", 1024),
			SendBufferSize:  getEnvAsInt("WS_SEND_BUFFER_SIZE", 256),
			RateLimit:       getEnvAsInt("WS_RATE_LIMIT", 10),
			RateBurst:       getEnvAsInt("WS_RATE_BURST", 20),
		},
		Game: GameConfig{
			MaxNumberPlayers:      gameFile.MaxNumberPlayers,
			MinNumberPlayers:      gameFile.MinNumberPlayers,
			CardsPerTurn:          gameFile.CardsPerTurn,
			MaxReshuffles:         gameFile.MaxReshuffles,
			CardsPerDraw:          gameFile.CardsPerDraw,
			Cards:                 CardsConfig{CardTypes: gameFile.Cards},
			LobbyResetSecs:        getEnvAsInt("LOBBY_RESET_SECS", 30),
			DisconnectTimeoutSecs: getEnvAsInt("DISCONNECT_TIMEOUT_SECS", 60),
		},
		Storage: StorageConfig{
			Backend:              strings.ToLower(getEnv("STORAGE_BACKEND", "local")),
			MaxAvatarUploadBytes: int64(getEnvAsInt("MAX_AVATAR_UPLOAD_BYTES", 2<<20)),
			AvatarUploadPrefix:   strings.Trim(getEnv("AVATAR_UPLOAD_PREFIX", getEnv("S3_AVATAR_PREFIX", "avatars")), "/"),
			LocalObjectDir:       getEnv("LOCAL_OBJECT_DIR", getEnv("LOCAL_AVATAR_DIR", "./uploads")),
			LocalPublicBaseURL:   strings.TrimRight(getEnv("LOCAL_PUBLIC_BASE_URL", getEnv("LOCAL_AVATAR_PUBLIC_PATH", "/user-assets")), "/"),
			S3Bucket:             getEnv("S3_BUCKET", ""),
			S3Region:             getEnv("S3_REGION", ""),
			S3Endpoint:           getEnv("S3_ENDPOINT", ""),
			S3AccessKeyID:        getEnv("S3_ACCESS_KEY_ID", ""),
			S3SecretAccessKey:    getEnv("S3_SECRET_ACCESS_KEY", ""),
			S3PublicBaseURL:      strings.TrimRight(getEnv("S3_PUBLIC_BASE_URL", ""), "/"),
			S3ForcePathStyle:     getEnvAsBool("S3_FORCE_PATH_STYLE", false),
			S3ACL:                getEnv("S3_ACL", ""),
		},
	}
}

// LoadGameFile reads and parses the game config YAML file at the given path.
// Returns an error if the file cannot be read, the YAML is invalid, or no cards
// are defined.
func LoadGameFile(path string) (GameFileConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return GameFileConfig{}, fmt.Errorf("failed to read game config %q: %w", path, err)
	}

	var cfg GameFileConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return GameFileConfig{}, fmt.Errorf("failed to parse game config %q: %w", path, err)
	}
	if cfg.CardsPerTurn <= 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q must set cards_per_turn greater than 0", path)
	}
	if cfg.MaxNumberPlayers <= 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q must set max_number_players greater than 0", path)
	}
	if cfg.MinNumberPlayers <= 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q must set min_number_players greater than 0", path)
	}
	if cfg.MinNumberPlayers > cfg.MaxNumberPlayers {
		return GameFileConfig{}, fmt.Errorf("game config %q has min_number_players greater than max_number_players", path)
	}
	if cfg.MaxReshuffles < 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q must set max_reshuffles greater than or equal to 0", path)
	}
	if cfg.CardsPerDraw <= 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q must set cards_per_draw greater than 0", path)
	}
	if len(cfg.Cards) == 0 {
		return GameFileConfig{}, fmt.Errorf("game config %q contains no cards", path)
	}
	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getGameConfigPath() string {
	if value := os.Getenv("GAME_CONFIG_PATH"); value != "" {
		return value
	}
	const dockerPath = "/app/config/game.yaml"
	if _, err := os.Stat(dockerPath); err == nil {
		return dockerPath
	}
	return "game.yaml"
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if valueStr == "" {
		return defaultValue
	}
	switch valueStr {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return defaultValue
	}
}

func getEnvAsStringSlice(key string) []string {
	raw := os.Getenv(key)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			result = append(result, t)
		}
	}
	return result
}
