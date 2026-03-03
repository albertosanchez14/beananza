package config

import (
	"log"
	"os"
	"strconv"

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
			Host: getEnv("SERVER_HOST", "localhost"),
			Port: getEnv("SERVER_PORT", "8080"),
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
