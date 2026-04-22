import { CardType, ExternalPlayer, Offer, OfferCard } from "@/schemas/types";

export type OfferPathEntry = {
  pathStr: string;
  color: string;
  playerId?: string;
};

export function getCenter(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function quadBezierPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
): string {
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const px = -dy / len;
  const py = dx / len;
  // Always bow upward: sign chosen so cpy = my + sign*py*bow < my
  const sign = py >= 0 ? -1 : 1;
  const bow = Math.min(len * 0.15, 80);
  const cpx = mx + sign * px * bow;
  const cpy = my + sign * py * bow;
  return `M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`;
}

export function handCardEl(
  card_id: string,
  card_type: string,
  hand: CardType[],
  cardRefs: Map<string, HTMLElement>,
): HTMLElement | null {
  if (card_id) return cardRefs.get(card_id) ?? null;
  const match = hand.find((h) => h.cardName === card_type);
  return match ? (cardRefs.get(match.cardId) ?? null) : null;
}

export function getTagEl(
  offer: Offer,
  tagWrapperRefs: Map<string, HTMLDivElement>,
): HTMLDivElement | null {
  return tagWrapperRefs.get(offer.id) ?? null;
}

export function resolveOfferedEl(
  c: OfferCard,
  centerCards: CardType[],
  cardRefs: Map<string, HTMLElement>,
  centerCardsRef: HTMLElement | null,
  hand: CardType[],
): HTMLElement | null {
  if (c.card_id && centerCards.some((cc) => cc.cardId === c.card_id))
    return cardRefs.get(c.card_id) ?? centerCardsRef;
  return handCardEl(c.card_id, c.card_type, hand, cardRefs);
}

export function broadcastTargets(
  offer: Offer,
  players: ExternalPlayer[],
  myPlayerId: string,
): ExternalPlayer[] {
  const rejected = new Set(offer.rejected_by ?? []);
  return players.filter(
    (p) => p.playerId !== myPlayerId && !rejected.has(p.playerId),
  );
}

export function addPath(
  next: Map<string, OfferPathEntry>,
  key: string,
  from: HTMLElement,
  to: HTMLElement,
  color: string,
  playerId?: string,
): void {
  next.set(key, {
    pathStr: quadBezierPath(getCenter(from), getCenter(to)),
    color,
    ...(playerId !== undefined && { playerId }),
  });
}

export function addPathsToTargets(
  next: Map<string, OfferPathEntry>,
  opponentFieldRefs: Map<string, HTMLElement>,
  prefix: string,
  fromEl: HTMLElement,
  targets: ExternalPlayer[],
  color: string,
): void {
  let pi = 0;
  targets.forEach((p) => {
    const targetEl = opponentFieldRefs.get(p.playerId) ?? null;
    if (targetEl)
      addPath(next, `${prefix}_${pi++}`, fromEl, targetEl, color, p.playerId);
  });
}

export function claimCard<T extends { cardId: string; cardName: string }>(
  pool: T[],
  c: OfferCard,
  claimed: Set<string>,
  fallback: HTMLElement | null,
  cardRefs: Map<string, HTMLElement>,
): HTMLElement | null {
  for (const item of pool) {
    const matches = c.card_id
      ? item.cardId === c.card_id || item.cardName === c.card_type
      : item.cardName === c.card_type;
    if (matches && !claimed.has(item.cardId)) {
      claimed.add(item.cardId);
      return cardRefs.get(item.cardId) ?? fallback;
    }
  }
  return null;
}
