import { CardType, Offer } from "@/schemas/types";

export function canAcceptOffer(
  offer: Offer,
  myHand: CardType[],
  centerCards: CardType[],
  isTurnPlayer: boolean,
): boolean {
  const consumedIds = new Set<string>();
  const needed: Record<string, number> = {};

  for (const c of offer.cards_requested) {
    if (c.card_id) {
      const has =
        myHand.some((h) => h.cardId === c.card_id) ||
        (isTurnPlayer && centerCards.some((h) => h.cardId === c.card_id));
      if (!has) return false;
      consumedIds.add(c.card_id);
    } else {
      needed[c.card_type] = (needed[c.card_type] ?? 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(needed)) {
    const available =
      myHand.filter((c) => c.cardName === type && !consumedIds.has(c.cardId))
        .length +
      (isTurnPlayer
        ? centerCards.filter(
            (c) => c.cardName === type && !consumedIds.has(c.cardId),
          ).length
        : 0);
    if (available < count) return false;
  }
  return true;
}
