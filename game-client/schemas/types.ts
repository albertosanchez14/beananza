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
  playerCoins: number;
  playerHandSize: number;
  playerField: FieldType;
};
