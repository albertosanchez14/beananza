export type BaseCard = {
  backImage: string;
};

export type CardType = BaseCard & {
  cardId: string;
  cardName: string;
  cardQuantity: number;
  frontImage: string;
  money_exchange: Record<string, number>;
};

export type CardTypeConfig = {
  name: string;
  count: number;
  front_image: string;
  back_image: string;
  exchange_rates: Record<string, number>;
};

export type GameConfig = {
  max_players: number;
  min_players: number;
  cards_per_turn: number;
  card_types: CardTypeConfig[];
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
  playerConnected?: boolean;
  playerDisconnectDeadline?: string | null;
};

export type WaitingPlayer = {
  id: string;
  name: string;
  avatar?: string;
  ready: boolean;
  joined_at: string;
  connected?: boolean;
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

export type Offer = {
  id: string;
  creator_id: string;
  target_id: string;
  parent_offer_id: string;
  cards_offered: OfferCard[];
  cards_requested: OfferCard[];
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  rejected_by: string[];
  created_at: string;
};

export type ToastEntry = {
  id: string;
  message: string;
  type: "error" | "success";
};

// DEFAULT VALUES
export const DEFAULT_GAME_CONFIG: GameConfig = {
  max_players: 5,
  min_players: 3,
  cards_per_turn: 2,
  card_types: [
    {
      name: "Judicultor",
      count: 6,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "2": 2, "3": 3 },
    },
    {
      name: "Judia Colora",
      count: 8,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "2": 1, "3": 2, "4": 3, "5": 4 },
    },
    {
      name: "Rocky Judia",
      count: 10,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "2": 1, "4": 2, "5": 3, "6": 4 },
    },
    {
      name: "Hippy Judia",
      count: 12,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "2": 1, "4": 2, "6": 3, "7": 4 },
    },
    {
      name: "La Pocha",
      count: 14,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "3": 1, "5": 2, "6": 3, "7": 4 },
    },
    {
      name: "La Apestosa",
      count: 16,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "3": 1, "5": 2, "7": 3, "8": 4 },
    },
    {
      name: "Judia Boom",
      count: 18,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "3": 1, "6": 2, "8": 3, "9": 4 },
    },
    {
      name: "Judia Bill",
      count: 20,
      front_image: "/cards/card.jpg",
      back_image: "/cards/bohnanza-back.jpg",
      exchange_rates: { "4": 1, "6": 2, "8": 3, "10": 4 },
    },
  ],
};
