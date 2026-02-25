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
  playerField: FieldType;
};

export type Player = {
  id: string;
  name: string;
  status: string;
  ready: boolean;
  coins: number;
  hand: CardType[];
  field: FieldType;
  beans_planted_turn: number;
  joined_at: string;
};
