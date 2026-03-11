import { useState } from "react";
import { WebSocketMessage } from "@/hooks/useActions";
import {
  CardType,
  ExternalPlayer,
  FieldType,
  Offer,
  WaitingPlayer,
} from "@/schemas/types";
import {
  GameStateResponsePayload,
  JoinedResponsePayload,
  Phases,
  SessionState,
  WaitingLobbyResponsePayload,
} from "@/schemas/messages";

// ---------------------------------------------------------------------------
// State shapes
// ---------------------------------------------------------------------------

export type GameState = {
  phase: Phases;
  hand: CardType[];
  pickedCards: CardType[];
  field: FieldType;
  centerCards: CardType[];
  players: ExternalPlayer[];
  offers: Offer[];
  playerTurn: string;
  deckSize: number;
  discardPileSize: number;
  discardTopCard: CardType | null;
  coins: number;
};

export type WaitingLobbyState = {
  allPlayers: Record<string, WaitingPlayer>;
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  myReadyState: boolean;
};

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_GAME_STATE: GameState = {
  phase: "plantHand",
  hand: [],
  pickedCards: [],
  field: { fieldID: "", slots: [] },
  centerCards: [],
  players: [],
  offers: [],
  playerTurn: "",
  deckSize: 0,
  discardPileSize: 0,
  discardTopCard: null,
  coins: 0,
};

const DEFAULT_LOBBY_STATE: WaitingLobbyState = {
  allPlayers: {},
  minPlayers: 3,
  maxPlayers: 5,
  canStart: false,
  myReadyState: false,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Tracks the top-level session state for a room, mirroring the server's
 * SessionState enum (waiting | playing | pause), plus the client-only
 * "connecting" state (before the first "joined" message arrives) and
 * "gameAlreadyStarted" (error state for non-members trying to join a live game).
 *
 * Transitions:
 *   "connecting"        — initial, before WS join handshake completes
 *   → "waiting"         — on "joined" with session_state "waiting"
 *   → "playing"         — on "joined" with session_state "playing",
 *                         or on broadcast "game_started"
 *   → "pause"           — on "joined" with session_state "pause"
 *   → "gameAlreadyStarted" — on error with code GAME_ALREADY_STARTED
 */
export function useSessionState(
  lastMessage: WebSocketMessage | null,
): SessionState {
  const [prevMessage, setPrevMessage] = useState<WebSocketMessage | null>(null);
  const [state, setState] = useState<SessionState>("connecting");

  if (lastMessage !== prevMessage && lastMessage !== null) {
    setPrevMessage(lastMessage);

    if (lastMessage.type === "joined") {
      const payload =
        lastMessage.payload as unknown as JoinedResponsePayload;
      const serverState = payload.session_state;
      if (
        serverState === "waiting" ||
        serverState === "playing" ||
        serverState === "pause"
      ) {
        setState(serverState);
        return serverState;
      }
    }

    if (lastMessage.type === "broadcast") {
      const broadcastPayload = lastMessage.payload as { event: string };
      if (broadcastPayload.event === "game_started") {
        setState("playing");
        return "playing";
      }
    }

    if (lastMessage.type === "error") {
      const errorPayload = lastMessage.payload as { code: string };
      if (errorPayload.code === "GAME_ALREADY_STARTED") {
        setState("gameAlreadyStarted");
        return "gameAlreadyStarted";
      }
    }
  }

  return state;
}

/**
 * Tracks the personalised game state emitted by the server via "myState" messages.
 * Only meaningful when the session is in the "playing" or "pause" state.
 * Starts from DEFAULT_GAME_STATE and updates on every matching message.
 */
export function useGameState(lastMessage: WebSocketMessage | null): GameState {
  const [prevMessage, setPrevMessage] = useState<WebSocketMessage | null>(null);
  const [state, setState] = useState<GameState>(DEFAULT_GAME_STATE);

  if (lastMessage?.type === "myState" && lastMessage !== prevMessage) {
    setPrevMessage(lastMessage);
    const payload = lastMessage.payload as unknown as GameStateResponsePayload;

    const next: GameState = {
      phase: payload.phase ?? state.phase,
      hand: payload.player?.hand ?? state.hand,
      pickedCards: payload.player?.picked_cards ?? state.pickedCards,
      field: payload.player?.field
        ? {
            fieldID: payload.player.field.fieldID,
            slots: payload.player.field.slots ?? [],
          }
        : state.field,
      centerCards: payload.center_cards ?? state.centerCards,
      players: payload.external_players ?? state.players,
      offers: payload.offers ?? state.offers,
      playerTurn:
        payload.turn_order && payload.turn_order.length > 0
          ? (payload.turn_order[payload.current_turn ?? 0] ?? state.playerTurn)
          : state.playerTurn,
      deckSize: payload.deck_size ?? state.deckSize,
      discardPileSize: payload.discard_pile_size ?? state.discardPileSize,
      discardTopCard: payload.discard_top_card ?? state.discardTopCard,
      coins: payload.player?.coins ?? state.coins,
    };

    setState(next);
    return next;
  }

  return state;
}

/**
 * Tracks the waiting lobby state emitted by the server via "waitingLobbyState" messages.
 * Only meaningful when the session is in the "waiting" state.
 * Starts from DEFAULT_LOBBY_STATE and updates on every matching message.
 */
export function useWaitingLobbyState(
  lastMessage: WebSocketMessage | null,
  playerId: string,
): WaitingLobbyState {
  const [prevMessage, setPrevMessage] = useState<WebSocketMessage | null>(null);
  const [state, setState] = useState<WaitingLobbyState>(DEFAULT_LOBBY_STATE);

  if (
    lastMessage?.type === "waitingLobbyState" &&
    lastMessage !== prevMessage
  ) {
    setPrevMessage(lastMessage);
    const payload =
      lastMessage.payload as unknown as WaitingLobbyResponsePayload;
    const waitingPlayers: Record<string, WaitingPlayer> = payload.players ?? {};

    const next: WaitingLobbyState = {
      allPlayers: waitingPlayers,
      minPlayers: payload.min_players ?? state.minPlayers,
      maxPlayers: payload.max_players ?? state.maxPlayers,
      canStart: payload.can_start ?? false,
      myReadyState: waitingPlayers[playerId]?.ready ?? false,
    };

    setState(next);
    return next;
  }

  return state;
}
