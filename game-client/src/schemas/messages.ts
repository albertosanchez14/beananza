import {
  CardType,
  ExternalPlayer,
  FieldType,
  Offer,
  Player,
  RankedPlayer,
  WaitingPlayer,
} from "@/schemas/types";

/**
 * Active game phases — only meaningful when the session is in the "playing"
 * state. "waiting" and "loading" have been moved to SessionState.
 */
export type Phases =
  | "plantHand"
  | "turnTrade"
  | "plantTrade"
  | "drawCards"
  | "finished";

/**
 * Top-level session states that mirror the server's SessionState enum.
 * "connecting" is a client-only state used before the first "joined" message.
 */
export type SessionState =
  | "connecting"
  | "waiting"
  | "playing"
  | "pause"
  | "gameAlreadyStarted";

export type WaitingLobbyResponsePayload = {
  can_start: boolean;
  max_players: number;
  min_players: number;
  players: Record<string, WaitingPlayer>;
  updated_at: string;
};

export type GameStateResponsePayload = {
  center_cards: Array<CardType>;
  current_turn: number;
  deck_size: number;
  discard_pile_size: number;
  discard_top_card: CardType | null;
  ended_at: string;
  external_players: Array<ExternalPlayer>;
  offers: Array<Offer>;
  phase: Phases;
  player: Player;
  room_id: string;
  started_at: string;
  turn_order: Array<string>;
  updated_at: string;
  min_players_deadline?: string | null;
  lobby_reset_at?: string | null;
  ranked_players?: Array<RankedPlayer>;
};

/** Sent by the server after a successful join or reconnect. */
export type JoinedResponsePayload = {
  player_id: string;
  session_token: string;
  /** Current session state — use this to route to the correct view. */
  session_state: "waiting" | "playing" | "pause";
};

/** Sent by the server as a broadcast event when a player joins or leaves. */
export type PlayerJoinedBroadcastData = {
  player_id: string;
  player_name: string;
  ready: boolean;
};

export type PlayerLeftBroadcastData = {
  player_id: string;
  player_name: string;
};

export type PlayerReadyBroadcastData = {
  player_id: string;
  ready: boolean;
};

// Re-export FieldType for convenience
export type { FieldType };
