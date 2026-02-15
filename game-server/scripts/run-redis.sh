#!/bin/bash
# Helper script to run Redis locally using Docker

echo "Starting Redis container for game-server..."

# Check if container already exists
if [ "$(docker ps -aq -f name=game-server-redis)" ]; then
    echo "Redis container already exists. Starting it..."
    docker start game-server-redis
else
    echo "Creating and starting new Redis container..."
    docker run -d \
        --name game-server-redis \
        -p 6379:6379 \
        redis:7-alpine
fi

echo "Redis is running on localhost:6379"
echo ""
echo "To connect to Redis CLI:"
echo "  docker exec -it game-server-redis redis-cli"
echo ""
echo "To stop Redis:"
echo "  docker stop game-server-redis"
echo ""
echo "To remove Redis container:"
echo "  docker stop game-server-redis && docker rm game-server-redis"
