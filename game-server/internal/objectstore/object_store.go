package objectstore

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"go.uber.org/zap"

	"github.com/yourusername/game-server/internal/config"
)

type ObjectStore interface {
	Put(ctx context.Context, key string, body io.Reader, contentType string) (publicURL string, err error)
	Delete(ctx context.Context, key string) error
}

type LocalStore struct {
	rootDir       string
	publicBaseURL string
}

type S3Store struct {
	client        *s3.Client
	bucket        string
	publicBaseURL string
	acl           string
}

func NewObjectStore(ctx context.Context, cfg config.StorageConfig, logger *zap.Logger) (ObjectStore, error) {
	switch cfg.Backend {
	case "", "local":
		return NewLocalStore(cfg.LocalObjectDir, cfg.LocalPublicBaseURL)
	case "s3":
		return NewS3Store(ctx, cfg, logger)
	default:
		return nil, fmt.Errorf("unsupported storage backend %q", cfg.Backend)
	}
}

func NewLocalStore(rootDir, publicBaseURL string) (*LocalStore, error) {
	if rootDir == "" {
		return nil, fmt.Errorf("local object directory is required")
	}
	if publicBaseURL == "" {
		return nil, fmt.Errorf("local public base URL is required")
	}
	if err := os.MkdirAll(rootDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create local object directory: %w", err)
	}
	return &LocalStore{
		rootDir:       rootDir,
		publicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}, nil
}

func (s *LocalStore) Put(_ context.Context, key string, body io.Reader, _ string) (string, error) {
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return "", err
	}

	dstPath := filepath.Join(s.rootDir, filepath.FromSlash(cleanKey))
	rootAbs, err := filepath.Abs(s.rootDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve local object root: %w", err)
	}
	dstAbs, err := filepath.Abs(dstPath)
	if err != nil {
		return "", fmt.Errorf("failed to resolve local object path: %w", err)
	}
	if dstAbs != rootAbs && !strings.HasPrefix(dstAbs, rootAbs+string(os.PathSeparator)) {
		return "", fmt.Errorf("object key escapes local object root")
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create local object directory: %w", err)
	}

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("failed to create local object: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, body); err != nil {
		return "", fmt.Errorf("failed to write local object: %w", err)
	}
	return publicURLForKey(s.publicBaseURL, cleanKey), nil
}

func (s *LocalStore) Delete(_ context.Context, key string) error {
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return err
	}

	objectPath := filepath.Join(s.rootDir, filepath.FromSlash(cleanKey))
	rootAbs, err := filepath.Abs(s.rootDir)
	if err != nil {
		return fmt.Errorf("failed to resolve local object root: %w", err)
	}
	objectAbs, err := filepath.Abs(objectPath)
	if err != nil {
		return fmt.Errorf("failed to resolve local object path: %w", err)
	}
	if objectAbs != rootAbs && !strings.HasPrefix(objectAbs, rootAbs+string(os.PathSeparator)) {
		return fmt.Errorf("object key escapes local object root")
	}

	if err := os.Remove(objectPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete local object: %w", err)
	}
	return nil
}

func NewS3Store(ctx context.Context, cfg config.StorageConfig, logger *zap.Logger) (*S3Store, error) {
	if cfg.S3Bucket == "" {
		return nil, fmt.Errorf("S3_BUCKET is required when STORAGE_BACKEND=s3")
	}
	if cfg.S3Region == "" {
		return nil, fmt.Errorf("S3_REGION is required when STORAGE_BACKEND=s3")
	}
	if cfg.S3PublicBaseURL == "" {
		return nil, fmt.Errorf("S3_PUBLIC_BASE_URL is required when STORAGE_BACKEND=s3")
	}
	if (cfg.S3AccessKeyID == "") != (cfg.S3SecretAccessKey == "") {
		return nil, fmt.Errorf("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together when STORAGE_BACKEND=s3")
	}

	s3Endpoint := strings.TrimRight(cfg.S3Endpoint, "/")
	if s3Endpoint != "" {
		endpointURL, err := url.Parse(s3Endpoint)
		if err != nil {
			return nil, fmt.Errorf("invalid S3_ENDPOINT: %w", err)
		}
		if endpointURL.Scheme == "" || endpointURL.Host == "" {
			return nil, fmt.Errorf("S3_ENDPOINT must include scheme and host")
		}
	}

	loadOptions := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(cfg.S3Region),
	}
	if cfg.S3AccessKeyID != "" {
		loadOptions = append(loadOptions, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.S3AccessKeyID, cfg.S3SecretAccessKey, cfg.S3SessionToken),
		))
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, loadOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to load S3 config: %w", err)
	}

	clientOptions := []func(*s3.Options){
		func(options *s3.Options) {
			options.UsePathStyle = cfg.S3ForcePathStyle
		},
	}
	if s3Endpoint != "" {
		clientOptions = append(clientOptions, func(options *s3.Options) {
			options.BaseEndpoint = aws.String(s3Endpoint)
		})
	}

	client := s3.NewFromConfig(awsCfg, clientOptions...)
	publicBaseURL := strings.TrimRight(cfg.S3PublicBaseURL, "/")

	logger.Info("object storage configured",
		zap.String("backend", "s3"),
		zap.String("bucket", cfg.S3Bucket),
		zap.String("region", cfg.S3Region),
		zap.String("endpoint", s3Endpoint),
		zap.Bool("force_path_style", cfg.S3ForcePathStyle),
		zap.Bool("static_credentials", cfg.S3AccessKeyID != ""),
	)

	return &S3Store{
		client:        client,
		bucket:        cfg.S3Bucket,
		publicBaseURL: publicBaseURL,
		acl:           cfg.S3ACL,
	}, nil
}

func (s *S3Store) Put(ctx context.Context, key string, body io.Reader, contentType string) (string, error) {
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return "", err
	}

	input := &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(cleanKey),
		Body:         body,
		ContentType:  aws.String(contentType),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	}
	if s.acl != "" {
		input.ACL = types.ObjectCannedACL(s.acl)
	}

	if _, err := s.client.PutObject(ctx, input); err != nil {
		return "", fmt.Errorf("failed to upload object to S3: %w", err)
	}
	return publicURLForKey(s.publicBaseURL, cleanKey), nil
}

func (s *S3Store) Delete(ctx context.Context, key string) error {
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return err
	}

	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(cleanKey),
	}); err != nil {
		return fmt.Errorf("failed to delete object from S3: %w", err)
	}
	return nil
}

func cleanObjectKey(key string) (string, error) {
	key = strings.ReplaceAll(strings.TrimSpace(key), "\\", "/")
	key = strings.Trim(key, "/")
	if key == "" {
		return "", fmt.Errorf("object key is required")
	}
	if strings.ContainsRune(key, 0) {
		return "", fmt.Errorf("object key contains null byte")
	}

	cleanKey := path.Clean(key)
	if cleanKey == "." || cleanKey == ".." || strings.HasPrefix(cleanKey, "../") {
		return "", fmt.Errorf("object key must stay within the object root")
	}
	return cleanKey, nil
}

func publicURLForKey(baseURL, key string) string {
	return strings.TrimRight(baseURL, "/") + "/" + escapeObjectKey(key)
}

func escapeObjectKey(key string) string {
	segments := strings.Split(key, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}
