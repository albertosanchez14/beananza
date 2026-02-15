import { CardType, FieldType, ExternalPlayer } from "@/schemas/types";

export const myDeckData: CardType[] = [
  { cardId: "1", cardName: "Rocky Judia" },
  { cardId: "2", cardName: "Judia Bill" },
  { cardId: "3", cardName: "Hippy Judia" },
  { cardId: "4", cardName: "Judia Boom" },
];
export const myFieldData: FieldType = [
  { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
  { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
];

export const centerCardsData: CardType[] = [
  { cardId: "20", cardName: "Judia Bill" },
  { cardId: "30", cardName: "Hippy Judia" },
];

export const playersData: ExternalPlayer[] = [
  {
    playerId: "player_1234",
    playerName: "Test player 1",
    playerCards: 4,
    playerField: [
      { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
      { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
    ],
  },
  {
    playerId: "player_3212",
    playerName: "Test player 2",
    playerCards: 3,
    playerField: [
      { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
      { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
    ],
  },
  {
    playerId: "player_2984",
    playerName: "Test player 3",
    playerCards: 5,
    playerField: [
      { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
      { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
    ],
  },
  {
    playerId: "player_1221",
    playerName: "Test player 4",
    playerCards: 4,
    playerField: [
      { slotId: "1", cardName: "Rocky Judia", cardQuantity: 3 },
      { slotId: "2", cardName: "Judia Bill", cardQuantity: 3 },
    ],
  },
];
