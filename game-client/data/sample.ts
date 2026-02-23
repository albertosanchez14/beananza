import { CardType, FieldType, ExternalPlayer } from "@/schemas/types";

export const myDeckData: CardType[] = [
  { cardId: "1", cardName: "Rocky Judia" },
  { cardId: "2", cardName: "Judia Bill" },
  { cardId: "3", cardName: "Hippy Judia" },
  { cardId: "4", cardName: "Judia Boom" },
];
export const myFieldData: FieldType = {
  fieldId: "my-field",
  slots: [
    { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
    { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
  ],
};

export const centerCardsData: CardType[] = [
  { cardId: "20", cardName: "Judia Bill" },
  { cardId: "30", cardName: "Hippy Judia" },
];

export const playersData: ExternalPlayer[] = [
  {
    playerId: "player_1234",
    playerName: "Test player 1",
    playerStatus: "active",
    playerCoins: 5,
    playerHandSize: 4,
    playerField: {
      fieldId: "field-player-1234",
      slots: [
        { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
        { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
      ],
    },
  },
  {
    playerId: "player_3212",
    playerName: "Test player 2",
    playerStatus: "active",
    playerCoins: 3,
    playerHandSize: 3,
    playerField: {
      fieldId: "field-player-3212",
      slots: [
        { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
        { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
      ],
    },
  },
  {
    playerId: "player_2984",
    playerName: "Test player 3",
    playerStatus: "active",
    playerCoins: 7,
    playerHandSize: 5,
    playerField: {
      fieldId: "field-player-2984",
      slots: [
        { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
        { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
      ],
    },
  },
  {
    playerId: "player_1221",
    playerName: "Test player 4",
    playerStatus: "active",
    playerCoins: 2,
    playerHandSize: 4,
    playerField: {
      fieldId: "field-player-1221",
      slots: [
        { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
        { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
      ],
    },
  },
];
