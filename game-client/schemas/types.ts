export type CardType = {
  cardId: string;
  cardName: string;
};

export type Slot = {
  slotId: string;
  cardName: string;
  cardQuantity: number;
};

export type FieldType = {
  fieldId: string;
  slots: Array<Slot>;
};

export type ExternalPlayer = {
  playerId: string;
  playerName: string;
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
