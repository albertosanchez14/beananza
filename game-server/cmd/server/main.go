package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
	"github.com/yourusername/game-server/internal/logger"
	"github.com/yourusername/game-server/internal/objectstore"
	"github.com/yourusername/game-server/internal/server"
	"github.com/yourusername/game-server/internal/storage"
	"github.com/yourusername/game-server/internal/websocket"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	log, err := logger.New(cfg.Logger.Level)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}
	defer log.Sync()

	log.Info("starting game server",
		zap.String("host", cfg.Server.Host),
		zap.String("port", cfg.Server.Port),
	)

	repo, err := storage.NewRepository(
		cfg.Redis.Addr,
		cfg.Redis.Password,
		cfg.Redis.DB,
		log,
	)
	if err != nil {
		return fmt.Errorf("failed to initialize redis: %w", err)
	}
	defer repo.Close()

	pubsub, err := storage.NewPubSub(
		cfg.Redis.Addr,
		cfg.Redis.Password,
		cfg.Redis.DB,
		log,
	)
	if err != nil {
		return fmt.Errorf("failed to initialize redis pub/sub: %w", err)
	}
	defer pubsub.Close()

	objectStore, err := objectstore.NewObjectStore(context.Background(), cfg.Storage, log)
	if err != nil {
		return fmt.Errorf("failed to initialize object storage: %w", err)
	}

	hub := websocket.NewHub(cfg, log, repo, pubsub)
	go hub.Run()

	srv := server.New(cfg, hub, repo, objectStore, log)
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- srv.Start()
	}()

	// Channel to listen for interrupt or terminate signal from OS
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		return fmt.Errorf("server error: %w", err)

	case sig := <-shutdown:
		log.Info("shutdown signal received",
			zap.String("signal", sig.String()),
		)

		// Give outstanding requests a deadline for completion
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		// Asking listener to shut down and shed load
		if err := srv.Shutdown(ctx); err != nil {
			if err := srv.Shutdown(context.Background()); err != nil {
				return fmt.Errorf("could not stop server gracefully: %w", err)
			}
		}
	}

	log.Info("server stopped successfully")
	return nil
}
