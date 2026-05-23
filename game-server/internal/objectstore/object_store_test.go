package objectstore

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/yourusername/game-server/internal/config"
	"go.uber.org/zap"
)

func TestLocalStorePutNestedObject(t *testing.T) {
	dir := t.TempDir()
	store, err := NewLocalStore(dir, "/user-assets/")
	if err != nil {
		t.Fatalf("NewLocalStore() error = %v", err)
	}

	publicURL, err := store.Put(context.Background(), "avatars/avatar.png", strings.NewReader("image-data"), "image/png")
	if err != nil {
		t.Fatalf("Put() error = %v", err)
	}
	if publicURL != "/user-assets/avatars/avatar.png" {
		t.Fatalf("Put() url = %q, want %q", publicURL, "/user-assets/avatars/avatar.png")
	}

	data, err := os.ReadFile(filepath.Join(dir, "avatars", "avatar.png"))
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if string(data) != "image-data" {
		t.Fatalf("saved data = %q, want %q", string(data), "image-data")
	}
}

func TestLocalStoreDeleteObject(t *testing.T) {
	dir := t.TempDir()
	store, err := NewLocalStore(dir, "/user-assets/")
	if err != nil {
		t.Fatalf("NewLocalStore() error = %v", err)
	}

	if _, err := store.Put(context.Background(), "avatars/avatar.png", strings.NewReader("image-data"), "image/png"); err != nil {
		t.Fatalf("Put() error = %v", err)
	}

	if err := store.Delete(context.Background(), "avatars/avatar.png"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "avatars", "avatar.png")); !os.IsNotExist(err) {
		t.Fatalf("deleted object stat error = %v, want not exist", err)
	}
}

func TestLocalStorePutRejectsTraversal(t *testing.T) {
	store, err := NewLocalStore(t.TempDir(), "/user-assets")
	if err != nil {
		t.Fatalf("NewLocalStore() error = %v", err)
	}

	if _, err := store.Put(context.Background(), "../avatar.png", strings.NewReader("image-data"), "image/png"); err == nil {
		t.Fatal("Put() error = nil, want traversal error")
	}
}

func TestPublicURLForKeyEscapesPathSegments(t *testing.T) {
	got := publicURLForKey("https://cdn.example.com/assets/", "avatars/my avatar.png")
	want := "https://cdn.example.com/assets/avatars/my%20avatar.png"
	if got != want {
		t.Fatalf("publicURLForKey() = %q, want %q", got, want)
	}
}

func TestNewS3StoreRequiresBucket(t *testing.T) {
	_, err := NewS3Store(context.Background(), config.StorageConfig{
		S3Region:        "us-east-1",
		S3PublicBaseURL: "https://cdn.example.com",
	}, zap.NewNop())
	if err == nil {
		t.Fatal("NewS3Store() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_BUCKET is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_BUCKET required error", err)
	}
}

func TestNewS3StoreRequiresRegion(t *testing.T) {
	_, err := NewS3Store(context.Background(), config.StorageConfig{
		S3Bucket:        "uploads",
		S3PublicBaseURL: "https://cdn.example.com",
	}, zap.NewNop())
	if err == nil {
		t.Fatal("NewS3Store() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_REGION is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_REGION required error", err)
	}
}

func TestNewS3StoreRequiresPublicBaseURL(t *testing.T) {
	_, err := NewS3Store(context.Background(), config.StorageConfig{
		S3Bucket: "uploads",
		S3Region: "us-east-1",
	}, zap.NewNop())
	if err == nil {
		t.Fatal("NewS3Store() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "S3_PUBLIC_BASE_URL is required when STORAGE_BACKEND=s3") {
		t.Fatalf("error = %q, want S3_PUBLIC_BASE_URL required error", err)
	}
}

func TestNewS3StoreRejectsPartialCredentials(t *testing.T) {
	_, err := NewS3Store(context.Background(), config.StorageConfig{
		S3Bucket:        "uploads",
		S3Region:        "us-east-1",
		S3PublicBaseURL: "https://cdn.example.com",
		S3AccessKeyID:   "key",
	}, zap.NewNop())
	if err == nil {
		t.Fatal("NewS3Store() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "must be set together") {
		t.Fatalf("error = %q, want credentials pair error", err)
	}
}

func TestNewS3StoreUsesCustomEndpointAndStaticCredentials(t *testing.T) {
	store, err := NewS3Store(context.Background(), config.StorageConfig{
		S3Bucket:          "uploads",
		S3Region:          "us-east-1",
		S3Endpoint:        "http://minio:9000/",
		S3AccessKeyID:     "minioadmin",
		S3SecretAccessKey: "miniosecret",
		S3PublicBaseURL:   "http://localhost:9000/uploads",
		S3ForcePathStyle:  true,
	}, zap.NewNop())
	if err != nil {
		t.Fatalf("NewS3Store() error = %v", err)
	}

	options := store.client.Options()
	if options.BaseEndpoint == nil || *options.BaseEndpoint != "http://minio:9000" {
		t.Fatalf("BaseEndpoint = %v, want http://minio:9000", options.BaseEndpoint)
	}
	if !options.UsePathStyle {
		t.Fatal("UsePathStyle = false, want true")
	}
	creds, err := options.Credentials.Retrieve(context.Background())
	if err != nil {
		t.Fatalf("Retrieve() error = %v", err)
	}
	if creds.AccessKeyID != "minioadmin" {
		t.Fatalf("AccessKeyID = %q, want minioadmin", creds.AccessKeyID)
	}
	if creds.SecretAccessKey != "miniosecret" {
		t.Fatalf("SecretAccessKey = %q, want miniosecret", creds.SecretAccessKey)
	}
}
