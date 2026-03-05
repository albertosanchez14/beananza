package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
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
}

// Load reads configuration from environment variables
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
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
		},
	}
}

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt gets an environment variable as int or returns a default value
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

// getEnvAsStringSlice splits a comma-separated environment variable into a
// slice of trimmed strings.  Returns nil (empty slice) when the variable is
// unset or empty.
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
