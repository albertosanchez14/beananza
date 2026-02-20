#!/bin/bash

# WebSocket Test Script
# Usage: ./test-ws.sh [room_id] [player_name]

ROOM_ID=${1:-"1111"}
PLAYER_NAME=${2:-"TestPlayer"}
WS_URL="ws://localhost:8080/ws"

echo "================================================"
echo "WebSocket Test Client"
echo "================================================"
echo "Connecting to: $WS_URL"
echo "Room ID: $ROOM_ID"
echo "Player Name: $PLAYER_NAME"
echo "================================================"
echo ""
echo "Sending JOIN message..."
echo ""

# Create the join message JSON
JOIN_MESSAGE=$(cat <<EOF
{"type":"join","room_id":"$ROOM_ID","payload":{"player_name":"$PLAYER_NAME"},"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"}
EOF
)

echo "Message to send:"
echo "$JOIN_MESSAGE"
echo ""
echo "================================================"
echo "Connected! You should receive the state message."
echo "Type additional messages or Ctrl+C to exit"
echo "================================================"
echo ""

# Send the message and keep connection open
echo "$JOIN_MESSAGE" | wscat -c "$WS_URL"
