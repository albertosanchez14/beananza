export type BaseCard = {
  backImage: string;
};

export type CardType = BaseCard & {
  cardId: string;
  cardName: string;
  frontImage?: string;
  money_exchange?: Record<string, number>;
};

/** A single card type as returned by GET /config */
export type CardTypeConfig = {
  name: string;
  count: number;
  front_image: string;
  back_image: string;
  exchange_rates: Record<string, number>;
};

/** Full game configuration returned by GET /config */
export type GameConfig = {
  max_players: number;
  min_players: number;
  cards_per_turn: number;
  cards: {
    card_types: CardTypeConfig[];
  };
};

export type SlotType = {
  slotId: string;
  cardName: string | null;
  cardIds: string[];
};

export type FieldType = {
  fieldID: string;
  slots: Array<SlotType>;
};

export type ExternalPlayer = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerStatus: string;
  playerReady: boolean;
  playerCoins: number;
  playerHandSize: number;
  playerPickedCardsCount: number;
  playerField: FieldType;
};

export type WaitingPlayer = {
  id: string;
  name: string;
  avatar?: string;
  ready: boolean;
  joined_at: string;
};

export type Player = {
  id: string;
  name: string;
  status: string;
  ready: boolean;
  coins: number;
  hand: CardType[];
  picked_cards: CardType[];
  field: FieldType;
  beans_planted_turn: number;
  joined_at: string;
};

export type OfferCard = {
  card_type: string;
  card_id: string;
};

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired";

export type Offer = {
  id: string;
  creator_id: string;
  target_id: string;
  parent_offer_id: string;
  cards_offered: OfferCard[];
  cards_requested: OfferCard[];
  status: OfferStatus;
  rejected_by: string[];
  created_at: string;
};

// All 8 bean card types available in the game
export const CARD_TYPES = [
  "Judicultor",
  "Judia Colora",
  "Rocky Judia",
  "Hippy Judia",
  "La Pocha",
  "La Apestosa",
  "Judia Boom",
  "Judia Bill",
] as const;

export type CardTypeName = (typeof CARD_TYPES)[number];
