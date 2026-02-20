package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

var (
	addr       = flag.String("addr", "localhost:8080", "WebSocket server address")
	roomID     = flag.String("room", "test-room", "Room ID to join")
	playerName = flag.String("name", "TestPlayer", "Player name")
)

type Message struct {
	Type      string          `json:"type"`
	RoomID    string          `json:"room_id,omitempty"`
	PlayerID  string          `json:"player_id,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

type JoinPayload struct {
	PlayerName string                 `json:"player_name"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

func main() {
	flag.Parse()
	log.SetFlags(0)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	url := fmt.Sprintf("ws://%s/ws", *addr)
	log.Printf("Connecting to %s", url)

	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	done := make(chan struct{})

	// Read messages from server
	go func() {
		defer close(done)
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read error:", err)
				return
			}

			// Pretty print the received message
			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("Failed to parse message: %v", err)
				log.Printf("Raw message: %s", string(message))
				continue
			}

			log.Printf("\n=== Received Message ===")
			log.Printf("Type: %s", msg.Type)
			log.Printf("Room ID: %s", msg.RoomID)
			log.Printf("Player ID: %s", msg.PlayerID)
			log.Printf("Timestamp: %s", msg.Timestamp)

			if msg.Payload != nil {
				var payload interface{}
				if err := json.Unmarshal(msg.Payload, &payload); err == nil {
					prettyPayload, _ := json.MarshalIndent(payload, "", "  ")
					log.Printf("Payload:\n%s", string(prettyPayload))
				}
			}
			log.Printf("=======================\n")
		}
	}()

	// Send join message
	joinPayload := JoinPayload{
		PlayerName: *playerName,
		Metadata:   map[string]interface{}{},
	}

	payloadBytes, err := json.Marshal(joinPayload)
	if err != nil {
		log.Fatal("marshal join payload:", err)
	}

	joinMsg := Message{
		Type:      "join",
		RoomID:    *roomID,
		Payload:   payloadBytes,
		Timestamp: time.Now(),
	}

	msgBytes, err := json.Marshal(joinMsg)
	if err != nil {
		log.Fatal("marshal join message:", err)
	}

	log.Printf("Sending join message to room '%s' as '%s'...", *roomID, *playerName)
	err = c.WriteMessage(websocket.TextMessage, msgBytes)
	if err != nil {
		log.Println("write error:", err)
		return
	}

	// Wait for interrupt signal or done
	for {
		select {
		case <-done:
			return
		case <-interrupt:
			log.Println("Interrupt received, closing connection...")

			// Cleanly close the connection
			err := c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("write close error:", err)
				return
			}
			select {
			case <-done:
			case <-time.After(time.Second):
			}
			return
		}
	}
}
