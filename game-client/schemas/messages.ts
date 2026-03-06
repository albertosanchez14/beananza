import {
  CardType,
  ExternalPlayer,
  FieldType,
  Offer,
  Player,
  WaitingPlayer,
} from "@/schemas/types";

export type Phases =
  | "plantHand"
  | "turnTrade"
  | "plantTrade"
  | "drawCards"
  | "waiting"
  | "finished";

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
  ended_at: string;
  external_players: Array<ExternalPlayer>;
  offers: Array<Offer>;
  phase: Phases;
  player: Player;
  room_id: string;
  started_at: string;
  turn_order: Array<string>;
  updated_at: string;
};

/** Sent by the server after a successful join, carrying the session token. */
export type JoinedResponsePayload = {
  player_id: string;
  session_token: string;
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
