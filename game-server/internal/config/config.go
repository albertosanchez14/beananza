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
	// An empty slice disables the check.
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
	S3SessionToken       string
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

type CardsFileConfig struct {
	Cards []CardTypeConfig `yaml:"cards"`
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

	cardsConfigPath := getCardsConfigPath()
	cardsFile, err := LoadCardsFile(cardsConfigPath)
	if err != nil {
		log.Fatalf("failed to load cards config: %v", err)
	}
	gameConfig, err := loadGameConfig(cardsFile.Cards)
	if err != nil {
		log.Fatalf("failed to load game config: %v", err)
	}

	storageConfig, err := loadStorageConfig()
	if err != nil {
		log.Fatalf("failed to load storage config: %v", err)
	}

	redisDB, err := getEnvAsInt("REDIS_DB", 0)
	if err != nil {
		log.Fatalf("failed to load redis config: %v", err)
	}
	readBufferSize, err := getEnvAsInt("READ_BUFFER_SIZE", 1024)
	if err != nil {
		log.Fatalf("failed to load websocket config: %v", err)
	}
	writeBufferSize, err := getEnvAsInt("WRITE_BUFFER_SIZE", 1024)
	if err != nil {
		log.Fatalf("failed to load websocket config: %v", err)
	}
	sendBufferSize, err := getEnvAsInt("WS_SEND_BUFFER_SIZE", 256)
	if err != nil {
		log.Fatalf("failed to load websocket config: %v", err)
	}
	rateLimit, err := getEnvAsInt("WS_RATE_LIMIT", 10)
	if err != nil {
		log.Fatalf("failed to load websocket config: %v", err)
	}
	rateBurst, err := getEnvAsInt("WS_RATE_BURST", 20)
	if err != nil {
		log.Fatalf("failed to load websocket config: %v", err)
	}

	cfg := &Config{
		Server: ServerConfig{
			Host:           getEnv("SERVER_HOST", "localhost"),
			Port:           getEnv("SERVER_PORT", "8080"),
			AllowedOrigins: getEnvAsStringSlice("ALLOWED_ORIGINS"),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       redisDB,
		},
		Logger: LoggerConfig{
			Level: getEnv("LOG_LEVEL", "info"),
		},
		WS: WebSocketConfig{
			ReadBufferSize:  readBufferSize,
			WriteBufferSize: writeBufferSize,
			SendBufferSize:  sendBufferSize,
			RateLimit:       rateLimit,
			RateBurst:       rateBurst,
		},
		Storage: storageConfig,
		Game:    gameConfig,
	}
	return cfg
}

// LoadCardsFile reads and parses the card config YAML file at the given path.
// Returns an error if the file cannot be read, the YAML is invalid, or no cards
// are defined.
func LoadCardsFile(path string) (CardsFileConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return CardsFileConfig{}, fmt.Errorf("failed to read cards config %q: %w", path, err)
	}

	var cfg CardsFileConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return CardsFileConfig{}, fmt.Errorf("failed to parse cards config %q: %w", path, err)
	}
	if len(cfg.Cards) == 0 {
		return CardsFileConfig{}, fmt.Errorf("cards config %q contains no cards", path)
	}
	return cfg, nil
}

func loadGameConfig(cardTypes []CardTypeConfig) (GameConfig, error) {
	maxNumberPlayers, err := getEnvAsInt("MAX_NUMBER_PLAYERS", 5)
	if err != nil {
		return GameConfig{}, err
	}
	minNumberPlayers, err := getEnvAsInt("MIN_NUMBER_PLAYERS", 3)
	if err != nil {
		return GameConfig{}, err
	}
	cardsPerTurn, err := getEnvAsInt("CARDS_PER_TURN", 2)
	if err != nil {
		return GameConfig{}, err
	}
	maxReshuffles, err := getEnvAsInt("MAX_RESHUFFLES", 3)
	if err != nil {
		return GameConfig{}, err
	}
	cardsPerDraw, err := getEnvAsInt("CARDS_PER_DRAW", 3)
	if err != nil {
		return GameConfig{}, err
	}
	lobbyResetSecs, err := getEnvAsInt("LOBBY_RESET_SECS", 30)
	if err != nil {
		return GameConfig{}, err
	}
	disconnectTimeoutSecs, err := getEnvAsInt("DISCONNECT_TIMEOUT_SECS", 60)
	if err != nil {
		return GameConfig{}, err
	}

	cfg := GameConfig{
		MaxNumberPlayers:      maxNumberPlayers,
		MinNumberPlayers:      minNumberPlayers,
		CardsPerTurn:          cardsPerTurn,
		MaxReshuffles:         maxReshuffles,
		CardsPerDraw:          cardsPerDraw,
		Cards:                 CardsConfig{CardTypes: cardTypes},
		LobbyResetSecs:        lobbyResetSecs,
		DisconnectTimeoutSecs: disconnectTimeoutSecs,
	}
	if err := validateGameConfig(cfg); err != nil {
		return GameConfig{}, err
	}
	return cfg, nil
}

func validateGameConfig(cfg GameConfig) error {
	if cfg.CardsPerTurn <= 0 {
		return fmt.Errorf("CARDS_PER_TURN must be greater than 0")
	}
	if cfg.MaxNumberPlayers <= 0 {
		return fmt.Errorf("MAX_NUMBER_PLAYERS must be greater than 0")
	}
	if cfg.MinNumberPlayers <= 0 {
		return fmt.Errorf("MIN_NUMBER_PLAYERS must be greater than 0")
	}
	if cfg.MinNumberPlayers > cfg.MaxNumberPlayers {
		return fmt.Errorf("MIN_NUMBER_PLAYERS must be less than or equal to MAX_NUMBER_PLAYERS")
	}
	if cfg.MaxReshuffles < 0 {
		return fmt.Errorf("MAX_RESHUFFLES must be greater than or equal to 0")
	}
	if cfg.CardsPerDraw <= 0 {
		return fmt.Errorf("CARDS_PER_DRAW must be greater than 0")
	}
	if len(cfg.Cards.CardTypes) == 0 {
		return fmt.Errorf("cards config contains no cards")
	}
	return nil
}

func loadStorageConfig() (StorageConfig, error) {
	maxAvatarUploadBytes, err := getEnvAsInt("MAX_AVATAR_UPLOAD_BYTES", 2<<20)
	if err != nil {
		return StorageConfig{}, err
	}
	s3ForcePathStyle, err := getEnvAsBool("S3_FORCE_PATH_STYLE", false)
	if err != nil {
		return StorageConfig{}, err
	}

	cfg := StorageConfig{
		Backend:              strings.ToLower(strings.TrimSpace(getEnv("STORAGE_BACKEND", "local"))),
		MaxAvatarUploadBytes: int64(maxAvatarUploadBytes),
		AvatarUploadPrefix:   strings.Trim(strings.TrimSpace(getEnv("AVATAR_UPLOAD_PREFIX", getEnv("S3_AVATAR_PREFIX", "avatars"))), "/"),
		LocalObjectDir:       strings.TrimSpace(getEnv("LOCAL_OBJECT_DIR", getEnv("LOCAL_AVATAR_DIR", "./uploads"))),
		LocalPublicBaseURL:   strings.TrimRight(strings.TrimSpace(getEnv("LOCAL_PUBLIC_BASE_URL", getEnv("LOCAL_AVATAR_PUBLIC_PATH", "/user-assets"))), "/"),
		S3Bucket:             strings.TrimSpace(getEnv("S3_BUCKET", "")),
		S3Region:             strings.TrimSpace(getEnv("S3_REGION", "")),
		S3Endpoint:           strings.TrimSpace(getEnv("S3_ENDPOINT", "/")),
		S3AccessKeyID:        strings.TrimSpace(getEnv("S3_ACCESS_KEY_ID", "")),
		S3SecretAccessKey:    strings.TrimSpace(getEnv("S3_SECRET_ACCESS_KEY", "")),
		S3SessionToken:       strings.TrimSpace(getEnv("S3_SESSION_TOKEN", "")),
		S3PublicBaseURL:      strings.TrimRight(strings.TrimSpace(getEnv("S3_PUBLIC_BASE_URL", "")), "/"),
		S3ForcePathStyle:     s3ForcePathStyle,
		S3ACL:                strings.TrimSpace(getEnv("S3_ACL", "")),
	}

	if err := validateStorageConfig(cfg); err != nil {
		return StorageConfig{}, err
	}
	return cfg, nil
}

func validateStorageConfig(cfg StorageConfig) error {
	if cfg.MaxAvatarUploadBytes <= 0 {
		return fmt.Errorf("MAX_AVATAR_UPLOAD_BYTES must be greater than 0")
	}

	switch cfg.Backend {
	case "", "local":
		if cfg.LocalObjectDir == "" {
			return fmt.Errorf("LOCAL_OBJECT_DIR is required when STORAGE_BACKEND=local")
		}
		if cfg.LocalPublicBaseURL == "" {
			return fmt.Errorf("LOCAL_PUBLIC_BASE_URL is required when STORAGE_BACKEND=local")
		}
	case "s3":
		if cfg.S3Bucket == "" {
			return fmt.Errorf("S3_BUCKET is required when STORAGE_BACKEND=s3")
		}
		if cfg.S3Region == "" {
			return fmt.Errorf("S3_REGION is required when STORAGE_BACKEND=s3")
		}
		if cfg.S3PublicBaseURL == "" {
			return fmt.Errorf("S3_PUBLIC_BASE_URL is required when STORAGE_BACKEND=s3")
		}
		if (cfg.S3AccessKeyID == "") != (cfg.S3SecretAccessKey == "") {
			return fmt.Errorf("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together when STORAGE_BACKEND=s3")
		}
	default:
		return fmt.Errorf("unsupported STORAGE_BACKEND %q", cfg.Backend)
	}
	return nil
}

func getCardsConfigPath() string {
	if value := os.Getenv("CARDS_CONFIG_PATH"); value != "" {
		return value
	}
	const dockerPath = "/app/config/cards.yaml"
	if _, err := os.Stat(dockerPath); err == nil {
		return dockerPath
	}
	return "cards.yaml"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) (int, error) {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", key)
	}
	return value, nil
}

func getEnvAsBool(key string, defaultValue bool) (bool, error) {
	valueStr := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if valueStr == "" {
		return defaultValue, nil
	}
	switch valueStr {
	case "yes", "y", "on":
		return true, nil
	case "no", "n", "off":
		return false, nil
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean", key)
	}
	return value, nil
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
