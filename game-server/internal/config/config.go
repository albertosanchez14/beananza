package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Server ServerConfig
	Redis  RedisConfig
	Logger LoggerConfig
	WS     WebSocketConfig
	Game   GameConfig
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
	// CardsPerTurn is the number of cards flipped face-up from the draw pile
	// during the "turn over beans" phase. Configurable via CARDS_PER_TURN (default 2).
	CardsPerTurn int
	Cards        CardsConfig
}

type CardsConfig struct {
	CardTypes []CardTypeConfig `yaml:"card_types" json:"card_types"`
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

	cardsPath := getEnv("CARDS_CONFIG_PATH", "cards.yaml")
	cards, err := LoadCards(cardsPath)
	if err != nil {
		log.Fatalf("failed to load cards config: %v", err)
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
			MaxNumberPlayers: getEnvAsInt("MAX_NUMBER_PLAYERS", 5),
			MinNumberPlayers: getEnvAsInt("MIN_NUMBER_PLAYERS", 3),
			CardsPerTurn:     getEnvAsInt("CARDS_PER_TURN", 2),
			Cards:            cards,
		},
	}
}

var (
	cardsOnce sync.Once
	cards     CardsConfig
)

// LoadCards reads and parses the cards.yaml file at the given path.
// Returns an error if the file cannot be read, the YAML is invalid, or no
// card types are defined.
func LoadCards(path string) (CardsConfig, error) {
	var loadErr error
	cardsOnce.Do(func() {
		data, err := os.ReadFile(path)
		if err != nil {
			loadErr = fmt.Errorf("failed to read cards config %q: %w", path, err)
			return
		}
		if err := yaml.Unmarshal(data, &cards); err != nil {
			loadErr = fmt.Errorf("failed to parse cards config %q: %w", path, err)
			return
		}
		if len(cards.CardTypes) == 0 {
			loadErr = fmt.Errorf("cards config %q contains no card_types", path)
		}
	})
	if loadErr != nil {
		return CardsConfig{}, loadErr
	}
	return cards, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
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
