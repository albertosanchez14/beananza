package objectstore

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/yourusername/game-server/internal/config"
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

func TestS3PublicBaseURLFromDigitalOceanEndpoint(t *testing.T) {
	got, err := s3PublicBaseURL(config.StorageConfig{
		S3Bucket:   "beananza-uploads",
		S3Endpoint: "https://fra1.digitaloceanspaces.com",
	})
	if err != nil {
		t.Fatalf("s3PublicBaseURL() error = %v", err)
	}
	want := "https://beananza-uploads.fra1.digitaloceanspaces.com"
	if got != want {
		t.Fatalf("s3PublicBaseURL() = %q, want %q", got, want)
	}
}

func TestS3PublicBaseURLUsesExplicitPublicURL(t *testing.T) {
	got, err := s3PublicBaseURL(config.StorageConfig{
		S3PublicBaseURL: "https://cdn.example.com/",
	})
	if err != nil {
		t.Fatalf("s3PublicBaseURL() error = %v", err)
	}
	want := "https://cdn.example.com"
	if got != want {
		t.Fatalf("s3PublicBaseURL() = %q, want %q", got, want)
	}
}

func TestS3PublicBaseURLPathStyle(t *testing.T) {
	got, err := s3PublicBaseURL(config.StorageConfig{
		S3Bucket:         "beananza-uploads",
		S3Endpoint:       "https://storage.example.com",
		S3ForcePathStyle: true,
	})
	if err != nil {
		t.Fatalf("s3PublicBaseURL() error = %v", err)
	}
	want := "https://storage.example.com/beananza-uploads"
	if got != want {
		t.Fatalf("s3PublicBaseURL() = %q, want %q", got, want)
	}
}
