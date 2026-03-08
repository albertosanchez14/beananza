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
  Phases,
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
  /** Number of cards flipped face-up per turn. Undefined until the first myState arrives. */
  cardsPerTurn: number | undefined;
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
  phase: "waiting",
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
  cardsPerTurn: undefined,
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
 * Tracks the personalised game state emitted by the server via "myState" messages.
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
      cardsPerTurn: payload.cards_per_turn ?? state.cardsPerTurn,
    };

    setState(next);
    return next;
  }

  return state;
}

/**
 * Tracks the waiting lobby state emitted by the server via "waitingLobbyState" messages.
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
