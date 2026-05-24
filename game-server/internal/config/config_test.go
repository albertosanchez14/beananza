package config

import (
	"strings"
	"testing"
)

func TestLoadStorageConfigDefaultLocal(t *testing.T) {
	clearStorageEnv(t)

	cfg, err := loadStorageConfig()
	if err != nil {
		t.Fatalf("loadStorageConfig() error = %v", err)
	}

	if cfg.Backend != "local" {
		t.Fatalf("Backend = %q, want local", cfg.Backend)
	}
	if cfg.MaxAvatarUploadBytes != 2<<20 {
		t.Fatalf("MaxAvatarUploadBytes = %d, want %d", cfg.MaxAvatarUploadBytes, 2<<20)
	}
}

func TestLoadRedisConfigRequiresURL(t *testing.T) {
	t.Setenv("REDIS_URL", "")

	_, err := loadRedisConfig()
	if err == nil {
		t.Fatal("loadRedisConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "REDIS_URL is required") {
		t.Fatalf("error = %q, want REDIS_URL required error", err)
	}
}

func TestLoadRedisConfigFromURL(t *testing.T) {
	t.Setenv("REDIS_URL", "rediss://:secret@redis.example.com:6380")

	cfg, err := loadRedisConfig()
	if err != nil {
		t.Fatalf("loadRedisConfig() error = %v", err)
	}

	if cfg.URL != "rediss://:secret@redis.example.com:6380" {
		t.Fatalf("URL = %q, want rediss://:secret@redis.example.com:6380", cfg.URL)
	}
}

func TestLoadRedisConfigRejectsInvalidURL(t *testing.T) {
	t.Setenv("REDIS_URL", "localhost:6379")

	_, err := loadRedisConfig()
	if err == nil {
		t.Fatal("loadRedisConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "REDIS_URL") {
		t.Fatalf("error = %q, want REDIS_URL error", err)
	}
}

func TestLoadStorageConfigInvalidUploadLimit(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("MAX_AVATAR_UPLOAD_BYTES", "not-a-number")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "MAX_AVATAR_UPLOAD_BYTES must be an integer") {
		t.Fatalf("error = %q, want MAX_AVATAR_UPLOAD_BYTES integer error", err)
	}
}

func TestLoadStorageConfigRequiresS3Bucket(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("STORAGE_BACKEND", "s3")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_BUCKET is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_BUCKET required error", err)
	}
}

func TestLoadStorageConfigRequiresS3Region(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("STORAGE_BACKEND", "s3")
	t.Setenv("S3_BUCKET", "uploads")
	t.Setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_REGION is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_REGION required error", err)
	}
}

func TestLoadStorageConfigRequiresS3PublicURL(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("STORAGE_BACKEND", "s3")
	t.Setenv("S3_BUCKET", "uploads")
	t.Setenv("S3_REGION", "us-east-1")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_PUBLIC_BASE_URL is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_PUBLIC_BASE_URL required error", err)
	}
}

func TestLoadStorageConfigS3CompatibleSettings(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("STORAGE_BACKEND", "s3")
	t.Setenv("S3_BUCKET", "uploads")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_ENDPOINT", "http://minio:9000/")
	t.Setenv("S3_ACCESS_KEY_ID", "minioadmin")
	t.Setenv("S3_SECRET_ACCESS_KEY", "miniosecret")
	t.Setenv("S3_PUBLIC_BASE_URL", "http://localhost:9000/uploads/")
	t.Setenv("S3_FORCE_PATH_STYLE", "true")

	cfg, err := loadStorageConfig()
	if err != nil {
		t.Fatalf("loadStorageConfig() error = %v", err)
	}

	if cfg.S3Endpoint != "http://minio:9000/" {
		t.Fatalf("S3Endpoint = %q, want http://minio:9000/", cfg.S3Endpoint)
	}
	if cfg.S3AccessKeyID != "minioadmin" {
		t.Fatalf("S3AccessKeyID = %q, want minioadmin", cfg.S3AccessKeyID)
	}
	if cfg.S3SecretAccessKey != "miniosecret" {
		t.Fatalf("S3SecretAccessKey = %q, want miniosecret", cfg.S3SecretAccessKey)
	}
	if cfg.S3PublicBaseURL != "http://localhost:9000/uploads" {
		t.Fatalf("S3PublicBaseURL = %q, want http://localhost:9000/uploads", cfg.S3PublicBaseURL)
	}
	if !cfg.S3ForcePathStyle {
		t.Fatal("S3ForcePathStyle = false, want true")
	}
}

func TestLoadStorageConfigRejectsPartialS3Credentials(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("STORAGE_BACKEND", "s3")
	t.Setenv("S3_BUCKET", "uploads")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.com")
	t.Setenv("S3_ACCESS_KEY_ID", "key")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "must be set together") {
		t.Fatalf("error = %q, want credentials pair error", err)
	}
}

func TestLoadStorageConfigInvalidForcePathStyle(t *testing.T) {
	clearStorageEnv(t)
	t.Setenv("S3_FORCE_PATH_STYLE", "not-a-bool")

	_, err := loadStorageConfig()
	if err == nil {
		t.Fatal("loadStorageConfig() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_FORCE_PATH_STYLE must be a boolean") {
		t.Fatalf("error = %q, want S3_FORCE_PATH_STYLE boolean error", err)
	}
}

func clearStorageEnv(t *testing.T) {
	t.Helper()

	for _, key := range []string{
		"STORAGE_BACKEND",
		"MAX_AVATAR_UPLOAD_BYTES",
		"AVATAR_UPLOAD_PREFIX",
		"S3_AVATAR_PREFIX",
		"LOCAL_OBJECT_DIR",
		"LOCAL_AVATAR_DIR",
		"LOCAL_PUBLIC_BASE_URL",
		"LOCAL_AVATAR_PUBLIC_PATH",
		"S3_BUCKET",
		"S3_REGION",
		"S3_ENDPOINT",
		"S3_ENDPOINT_URL",
		"S3_ACCESS_KEY_ID",
		"S3_SECRET_ACCESS_KEY",
		"S3_SESSION_TOKEN",
		"S3_PUBLIC_BASE_URL",
		"S3_FORCE_PATH_STYLE",
		"S3_ACL",
	} {
		t.Setenv(key, "")
	}
}
