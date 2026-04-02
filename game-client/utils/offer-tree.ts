import { Offer } from "@/schemas/types";

/** Returns all offers in the subtree rooted at rootId (BFS, including root). */
export function getOfferSubtree(allOffers: Offer[], rootId: string): Offer[] {
  const byId = new Map(allOffers.map((o) => [o.id, o]));
  const childrenOf = new Map<string, Offer[]>();
  for (const o of allOffers) {
    if (o.parent_offer_id) {
      const arr = childrenOf.get(o.parent_offer_id) ?? [];
      arr.push(o);
      childrenOf.set(o.parent_offer_id, arr);
    }
  }

  const result: Offer[] = [];
  const queue = [rootId];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const id = queue[queueIndex++];
    const offer = byId.get(id);
    if (!offer) continue;
    result.push(offer);
    for (const child of childrenOf.get(id) ?? []) queue.push(child.id);
  }
  return result;
}

/**
 * Returns pending offers that have no children — the "tips" of the tree
 * that the current player should act on.
 */
export function getLeaves(subtree: Offer[]): Offer[] {
  const parentIds = new Set<string>();
  const pendingOffers: Offer[] = [];

  for (const offer of subtree) {
    if (offer.status !== "pending") continue;
    pendingOffers.push(offer);
    if (offer.parent_offer_id) parentIds.add(offer.parent_offer_id);
  }

  return pendingOffers.filter((offer) => !parentIds.has(offer.id));
}

/** Builds a map from each offer id to its children within the subtree. */
export function buildChildrenMap(subtree: Offer[]): Map<string, Offer[]> {
  const map = new Map<string, Offer[]>();
  for (const o of subtree) {
    if (!map.has(o.id)) map.set(o.id, []);
    if (o.parent_offer_id) {
      const arr = map.get(o.parent_offer_id) ?? [];
      arr.push(o);
      map.set(o.parent_offer_id, arr);
    }
  }
  return map;
}
