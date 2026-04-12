import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CardType, Offer, OfferCard, SlotType } from "@/schemas/types";

import { useGameContext } from "@/components/game-context";

import Table from "@/components/table";
import { CardPile, CenterCards } from "@/components/card-pile";
import Opponents, { getFieldRotation } from "@/components/opponents";
import Center from "@/components/center";
import CurrentPlayer from "@/components/current-player";
import Slot from "@/components/slot";
import Field from "@/components/field";
import TradedCardsArea from "@/components/traded-cards-area";
import FanLayout from "@/components/fan-layout";
import Card from "@/components/card";
import Player from "@/components/player";
import { FlyingCard } from "@/components/flying-card";
import { PlantFlyingCard } from "@/components/plant-flying-card";
import { TurnOverFlyingCard } from "@/components/turn-over-flying-card";
import AcceptCardPicker from "@/components/accept-card-picker";
import Arrow from "@/components/arrow";
import { canAcceptOffer } from "@/components/offer-card";

import {
  addPath,
  addPathsToTargets,
  broadcastTargets,
  claimCard,
  getTagEl,
  OfferPathEntry,
  resolveOfferedEl,
} from "@/utils/offer-arrow-utils";
import InlineModal from "@/components/inline-modal";

type FlyingCardEntry = {
  id: string;
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  index: number;
  zIndex: number;
  targetRotate: number;
};

type TurnOverFlyingCardEntry = {
  id: string;
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  index: number;
  cardScale: number;
};

const ORIGIN_COLORS = {
  hand: "#38bdf8",
  center: "#a3e635",
  player: "#f472b6",
  blocked: "#ef4444",
} as const;

function enrichWithCenterIds(
  reqCards: OfferCard[],
  centerCards: CardType[],
  isTurnPlayer: boolean,
): OfferCard[] {
  if (isTurnPlayer) return reqCards;
  const usedIds = new Set<string>();
  return reqCards.map((c) => {
    const match = centerCards.find(
      (cc) => cc.cardName === c.card_type && !usedIds.has(cc.cardId),
    );
    if (match) {
      usedIds.add(match.cardId);
      return { ...c, card_id: match.cardId };
    }
    return c;
  });
}

function canProvideOfferedCards(
  offer: Offer,
  myHand: CardType[],
  centerCards: CardType[],
  isTurnPlayer: boolean,
): boolean {
  const availableIds = new Set<string>();
  const availableCounts: Record<string, number> = {};

  for (const c of myHand) {
    availableIds.add(c.cardId);
    availableCounts[c.cardName] = (availableCounts[c.cardName] ?? 0) + 1;
  }
  if (isTurnPlayer) {
    for (const c of centerCards) {
      availableIds.add(c.cardId);
      availableCounts[c.cardName] = (availableCounts[c.cardName] ?? 0) + 1;
    }
  }

  const neededByType: Record<string, number> = {};
  for (const c of offer.cards_offered) {
    if (c.card_id) {
      if (!availableIds.has(c.card_id)) return false;
      continue;
    }
    neededByType[c.card_type] = (neededByType[c.card_type] ?? 0) + 1;
  }

  for (const [type, needed] of Object.entries(neededByType)) {
    if ((availableCounts[type] ?? 0) < needed) return false;
  }

  return true;
}

type PlantFlyingCardEntry = {
  id: string;
  slotIndex?: number;
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetRotateX?: number;
  targetScaleX?: number;
  initialRotate?: number;
  targetRotate?: number;
  initialScale?: number;
  targetScale?: number;
  opponentSlotId?: string;
  slotWasEmpty?: boolean;
};

export default function Board() {
  const {
    gameState,
    cardsPerTurn,
    cardLookup,
    myPlayerId,
    selection,
    clearSelection,
    handleCardClick,
    handleCardDrag,
    dragOverSlot,
    handleSlotClick,
    handleSlotDrop,
    handleSlotDragOver,
    handleSlotDragLeave,
    dragOverPlayerId,
    dragOverBlockReason,
    handlePlayerDragOver,
    handlePlayerDragLeave,
    handlePlayerDrop,
    playerDropResult,
    clearPlayerDropResult,
    handleDrawDeckClick,
    offers,
    onCreateOffer,
    onRespondOffer,
    onCounterOffer,
  } = useGameContext();
  const [hoveredOfferId, setHoveredOfferId] = useState<string | null>(null);

  const [acceptPickerOffer, setAcceptPickerOffer] = useState<
    (typeof offers)[0] | null
  >(null);
  const [counteringOffer, setCounteringOffer] = useState<Offer | null>(null);
  const [inlineModal, setInlineModal] = useState<{
    key: number;
    cardsRequested: CardType[];
    defaultOfferedCards?: CardType[];
    defaultTargetId?: string;
  } | null>(null);
  let inlineModalKeyRef = useRef(0);
  const openInlineModal = (state: {
    cardsRequested: CardType[];
    defaultOfferedCards?: CardType[];
    defaultTargetId?: string;
  }) => setInlineModal({ ...state, key: ++inlineModalKeyRef.current });
  const [draftState, setDraftState] = useState<{
    requested: CardType[];
    offered: CardType[];
    targetId: string | undefined;
  } | null>(null);

  // ── Offered-cards selection state (owned by Board, fed into InlineModal) ─────
  const [offeredCards, setOfferedCards] = useState<CardType[]>([]);

  // ── Requested-cards editing state (lifted from InlineModal) ─────────────────
  const [reqQty, setReqQty] = useState<Record<string, number>>({});
  const [reqTarget, setReqTarget] = useState<string | undefined>(undefined);
  const [showReqPicker, setShowReqPicker] = useState(false);

  const tradedCardsAreaRef = useRef<HTMLDivElement>(null);
  const draftCardsGroupRef = useRef<HTMLDivElement>(null);

  const {
    centerCards,
    discardTopCard,
    deckSize,
    discardPileSize,
    hand,
    players,
    playerTurn,
    phase,
    field,
    coins,
    pickedCards,
  } = gameState;

  const isTurnPlayer = myPlayerId === playerTurn;

  // ── Requested-cards edit derived state ───────────────────────────────────────
  const allCatalogCards = useMemo(
    () =>
      Array.from(cardLookup.values()).sort(
        (a, b) => b.cardQuantity - a.cardQuantity,
      ),
    [cardLookup],
  );

  const resolvedRequested = useMemo(() => {
    const result: CardType[] = [];
    for (const [name, qty] of Object.entries(reqQty)) {
      const pool = [
        ...centerCards.filter((c) => c.cardName === name),
        ...hand.filter((c) => c.cardName === name),
      ];
      for (let i = 0; i < qty; i++) {
        const card = pool[i] ?? cardLookup.get(name);
        if (card) result.push(card);
      }
    }
    return result;
  }, [reqQty, hand, centerCards, cardLookup]);

  const adjustReqQty = useCallback((cardName: string, delta: number) => {
    setReqQty((prev) => {
      const total = Object.values(prev).reduce((s, n) => s + n, 0);
      const current = prev[cardName] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0 && total <= 1) return prev;
      if (next === 0) {
        const rest = { ...prev };
        delete rest[cardName];
        return rest;
      }
      return { ...prev, [cardName]: next };
    });
  }, []);

  const removeReqQty = useCallback((cardName: string) => {
    setReqQty((prev) => {
      if (Object.keys(prev).length <= 1) return prev;
      const rest = { ...prev };
      delete rest[cardName];
      return rest;
    });
  }, []);

  const addReqCard = useCallback((cardName: string) => {
    setReqQty((prev) => ({ ...prev, [cardName]: (prev[cardName] ?? 0) + 1 }));
    setShowReqPicker(false);
  }, []);

  // Initialize reqQty / reqTarget / offeredCards when a new inline modal opens.
  useEffect(() => {
    if (!inlineModal) {
      setReqQty({});
      setReqTarget(undefined);
      setShowReqPicker(false);

      setOfferedCards([]);
      return;
    }
    const initQty: Record<string, number> = {};
    for (const c of inlineModal.cardsRequested) {
      initQty[c.cardName] = (initQty[c.cardName] ?? 0) + 1;
    }
    setReqQty(initQty);
    setReqTarget(
      inlineModal.defaultTargetId ??
        (myPlayerId !== playerTurn ? playerTurn : undefined),
    );
    setOfferedCards(inlineModal.defaultOfferedCards ?? []);
  }, [inlineModal?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep draftState.requested, targetId, and offered in sync.
  useEffect(() => {
    if (!inlineModal && !counteringOffer) return;
    setDraftState((prev) =>
      prev
        ? { ...prev, requested: resolvedRequested, targetId: reqTarget }
        : null,
    );
  }, [resolvedRequested, reqTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!inlineModal && !counteringOffer) return;
    setDraftState((prev) => (prev ? { ...prev, offered: offeredCards } : null));
  }, [offeredCards]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize state when a counter offer is triggered.
  useEffect(() => {
    if (!counteringOffer) {
      setReqQty({});
      setReqTarget(undefined);
      setShowReqPicker(false);

      setOfferedCards([]);
      setDraftState(null);
      return;
    }
    // Pre-populate: mirror the parent offer.
    // offeredCards ← parent's cards_requested (what they asked us for)
    // Hand first, then center cards (turn player only).
    const handCopy = [...hand];
    const centerCopy = isTurnPlayer ? [...centerCards] : [];
    const preOffered: CardType[] = [];
    for (const c of counteringOffer.cards_requested) {
      const handIdx = handCopy.findIndex((h) => h.cardName === c.card_type);
      if (handIdx >= 0) {
        preOffered.push(handCopy[handIdx]);
        handCopy.splice(handIdx, 1);
        continue;
      }
      const centerIdx = centerCopy.findIndex(
        (cc) => cc.cardName === c.card_type,
      );
      if (centerIdx >= 0) {
        preOffered.push(centerCopy[centerIdx]);
        centerCopy.splice(centerIdx, 1);
      }
    }
    setOfferedCards(preOffered);
    // requestedQty ← parent's cards_offered (what they offered us)
    const initQty: Record<string, number> = {};
    for (const c of counteringOffer.cards_offered) {
      initQty[c.card_type] = (initQty[c.card_type] ?? 0) + 1;
    }
    setReqQty(initQty);
    setReqTarget(counteringOffer.creator_id);
    setShowReqPicker(false);
    setDraftState({
      offered: preOffered,
      requested: [],
      targetId: counteringOffer.creator_id,
    });
  }, [counteringOffer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build ghost offer node for live counter draft preview.
  const allOffersWithGhost = useMemo<Offer[]>(() => {
    if (!counteringOffer) return offers;
    const ghost: Offer = {
      id: "__draft__",
      creator_id: myPlayerId,
      target_id: counteringOffer.creator_id,
      parent_offer_id: counteringOffer.id,
      cards_offered: offeredCards.map((c) => ({
        card_type: c.cardName,
        card_id: c.cardId,
      })),
      cards_requested: Object.entries(reqQty).flatMap(([name, qty]) =>
        Array.from({ length: qty }, () => ({ card_type: name, card_id: "" })),
      ),
      status: "pending",
      rejected_by: [],
      created_at: new Date().toISOString(),
    };
    return [...offers, ghost];
  }, [offers, counteringOffer, offeredCards, reqQty, myPlayerId]);

  // ── Origin-highlight helpers ─────────────────────────────────────────────────
  // cardHighlights: cardId → color for cards I can see (my hand + center)
  // playerHighlights: playerId → { color, count } for opponent hand cards in offers
  const { cardHighlights, playerHighlights } = useMemo(() => {
    const cardH = new Map<string, string>();
    const playerH = new Map<string, { color: string; count: number }>();
    if (phase !== "turnTrade" || !hoveredOfferId)
      return { cardHighlights: cardH, playerHighlights: playerH };

    const offer = offers.find(
      (o) => o.status === "pending" && o.id === hoveredOfferId,
    );

    if (!offer) return { cardHighlights: cardH, playerHighlights: playerH };

    const isOwn = offer.creator_id === myPlayerId;
    const isIncoming =
      (offer.target_id === myPlayerId || offer.target_id === "") &&
      offer.creator_id !== myPlayerId;
    if (!isOwn && !isIncoming)
      return { cardHighlights: cardH, playerHighlights: playerH };

    // Cards from my side (my hand or my center).
    // For incoming offers the current player is not the turn player and cannot
    // use center cards — only highlight hand matches.
    const myCards = isOwn ? offer.cards_offered : offer.cards_requested;
    const amTurnPlayer = myPlayerId === playerTurn;
    const isBroadcast = offer.target_id === "";
    const highlightColor = isBroadcast
      ? ORIGIN_COLORS.player
      : isIncoming
        ? ORIGIN_COLORS.center
        : ORIGIN_COLORS.hand; // outgoing non-broadcast: always cyan
    for (const c of myCards) {
      if (c.card_id) {
        // Explicit card ID — resolve color from the specific card's location.
        const color =
          isIncoming && !isBroadcast && !amTurnPlayer
            ? hand.some((h) => h.cardId === c.card_id)
              ? highlightColor
              : null
            : highlightColor;
        if (color && !cardH.has(c.card_id)) cardH.set(c.card_id, color);
      } else {
        // Type-only request: highlight exactly one unclaimed card.
        // Priority: center cards first (turn player only), then hand — first in array order.
        const priorityPool: Array<{ card: CardType; color: string }> = [];
        if (amTurnPlayer) {
          for (const cc of centerCards) {
            if (cc.cardName === c.card_type)
              priorityPool.push({ card: cc, color: highlightColor });
          }
        }
        for (const hc of hand) {
          if (hc.cardName === c.card_type)
            priorityPool.push({ card: hc, color: highlightColor });
        }
        for (const { card, color } of priorityPool) {
          if (!cardH.has(card.cardId)) {
            cardH.set(card.cardId, color);
            break;
          }
        }
      }
    }

    // Cards on the other player's side — only highlight center cards when
    // we have an exact card_id match. Type fallback is unreliable here: the
    // same card type may exist in the center while the request targets a
    // player's hand, so we must not highlight the center card in that case.
    const theirCards = isOwn ? offer.cards_requested : offer.cards_offered;
    const otherPlayerId = isOwn ? offer.target_id : offer.creator_id;
    for (const c of theirCards) {
      const inCenter = !!(
        c.card_id && centerCards.some((cc) => cc.cardId === c.card_id)
      );
      if (inCenter) {
        const color = isBroadcast
          ? ORIGIN_COLORS.player
          : isOwn
            ? ORIGIN_COLORS.hand
            : ORIGIN_COLORS.center;
        if (!cardH.has(c.card_id)) cardH.set(c.card_id, color);
      } else if (otherPlayerId === "") {
        // Broadcast offer — highlight every other player.
        for (const p of players) {
          if (p.playerId === myPlayerId) continue;
          const existing = playerH.get(p.playerId);
          playerH.set(p.playerId, {
            color: ORIGIN_COLORS.player,
            count: (existing?.count ?? 0) + 1,
          });
        }
      } else if (otherPlayerId) {
        const existing = playerH.get(otherPlayerId);
        playerH.set(otherPlayerId, {
          color: ORIGIN_COLORS.player,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
    return { cardHighlights: cardH, playerHighlights: playerH };
  }, [
    offers,
    hand,
    centerCards,
    players,
    myPlayerId,
    phase,
    playerTurn,
    hoveredOfferId,
  ]);

  // ── Draft offer highlights (inline modal) ───────────────────────────────────
  // Maps cardId → color for hand/center cards involved in the in-progress draft.
  const draftColor = draftState
    ? draftState.targetId
      ? ORIGIN_COLORS.hand
      : ORIGIN_COLORS.player
    : undefined;

  const { draftCardHighlights, draftPlayerHighlights } = useMemo(() => {
    const cardH = new Map<string, string>();
    const playerH = new Map<string, { color: string; count: number }>();
    if (!draftState || !draftColor)
      return { draftCardHighlights: cardH, draftPlayerHighlights: playerH };

    const color = draftColor;

    // Receiving: per-card highlight.
    // Non-turn player + center card → specific card highlight.
    // Everything else (turn player always, non-turn requesting from hand) →
    // count-based opponent hand highlight.
    const centerIds = new Set(centerCards.map((c) => c.cardId));
    for (const card of draftState.requested) {
      if (!isTurnPlayer && centerIds.has(card.cardId)) {
        cardH.set(card.cardId, color);
      } else {
        if (draftState.targetId) {
          const existing = playerH.get(draftState.targetId);
          playerH.set(draftState.targetId, {
            color,
            count: (existing?.count ?? 0) + 1,
          });
        } else {
          for (const p of players) {
            if (p.playerId === myPlayerId) continue;
            const existing = playerH.get(p.playerId);
            playerH.set(p.playerId, {
              color,
              count: (existing?.count ?? 0) + 1,
            });
          }
        }
      }
    }

    // Giving: highlight my offered hand cards.
    for (const c of draftState.offered) {
      cardH.set(c.cardId, color);
    }

    return { draftCardHighlights: cardH, draftPlayerHighlights: playerH };
  }, [draftState, draftColor, isTurnPlayer, centerCards, players, myPlayerId]);

  // Ghost cards: missing cards for the hovered offer that this player must provide
  // (incoming: cards_requested, own outgoing/counter: cards_offered).
  // Non-interactive phantoms are appended to the player's hand for deficits.
  const ghostCards = useMemo<CardType[]>(() => {
    if (!hoveredOfferId || phase !== "turnTrade") return [];
    const offer = offers.find(
      (o) => o.id === hoveredOfferId && o.status === "pending",
    );
    if (!offer) return [];

    const isOwn = offer.creator_id === myPlayerId;
    const isIncoming =
      !isOwn && (offer.target_id === myPlayerId || offer.target_id === "");
    if (!isOwn && !isIncoming) return [];

    const requiredCards = isOwn ? offer.cards_offered : offer.cards_requested;

    const availableCounts: Record<string, number> = {};
    const availableIds = new Set<string>();
    for (const c of hand) {
      availableIds.add(c.cardId);
      availableCounts[c.cardName] = (availableCounts[c.cardName] ?? 0) + 1;
    }
    if (isTurnPlayer) {
      for (const c of centerCards) {
        availableIds.add(c.cardId);
        availableCounts[c.cardName] = (availableCounts[c.cardName] ?? 0) + 1;
      }
    }

    const requiredByType: Record<string, number> = {};
    const missingByType: Record<string, number> = {};
    for (const c of requiredCards) {
      if (c.card_id) {
        if (!availableIds.has(c.card_id)) {
          missingByType[c.card_type] = (missingByType[c.card_type] ?? 0) + 1;
        }
        continue;
      }
      requiredByType[c.card_type] = (requiredByType[c.card_type] ?? 0) + 1;
    }

    const ghosts: CardType[] = [];
    let idx = 0;
    for (const [cardType, needed] of Object.entries(requiredByType)) {
      const deficit = Math.max(0, needed - (availableCounts[cardType] ?? 0));
      if (deficit > 0) {
        missingByType[cardType] = (missingByType[cardType] ?? 0) + deficit;
      }
    }

    for (const [cardType, deficit] of Object.entries(missingByType)) {
      const base = cardLookup.get(cardType);
      if (!base || deficit === 0) continue;
      for (let i = 0; i < deficit; i++) {
        ghosts.push({ ...base, cardId: `ghost_${hoveredOfferId}_${idx++}` });
      }
    }
    return ghosts;
  }, [
    hoveredOfferId,
    offers,
    hand,
    centerCards,
    myPlayerId,
    isTurnPlayer,
    phase,
    cardLookup,
  ]);

  const deckRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentHandContainerRefs = useRef<Map<string, HTMLDivElement>>(
    new Map(),
  );
  const opponentFieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const centerCardsRef = useRef<HTMLDivElement>(null);
  const tagWrapperRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevHandRef = useRef<CardType[]>(hand);
  const prevPlayersRef = useRef(players);
  const prevCenterCardsRef = useRef<CardType[]>(centerCards);
  const prevCenterCardRectsRef = useRef<
    Map<string, { left: number; top: number }>
  >(new Map());
  const prevCenterCardsForTurnRef = useRef<CardType[]>(centerCards);
  const prevFieldRef = useRef(field);
  const dragPlantedCardIds = useRef<Set<string>>(new Set());
  const mySlotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mySlotCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevHandCardRectsRef = useRef<
    Map<string, { left: number; top: number }>
  >(new Map());
  const snapshotCenterRects = useRef<
    Map<string, { left: number; top: number }>
  >(new Map());

  const [flyingCards, setFlyingCards] = useState<FlyingCardEntry[]>([]);
  const [turnOverFlyingCards, setTurnOverFlyingCards] = useState<
    TurnOverFlyingCardEntry[]
  >([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [hiddenCenterCardIds, setHiddenCenterCardIds] = useState<Set<string>>(
    new Set(),
  );
  const [plantFlyingCards, setPlantFlyingCards] = useState<
    PlantFlyingCardEntry[]
  >([]);
  const [animatingOpponentSlotIds, setAnimatingOpponentSlotIds] = useState<
    Set<string>
  >(new Set());
  const [offerPaths, setOfferPaths] = useState<Map<string, OfferPathEntry>>(
    new Map(),
  );
  const [activeBroadcastPlayerId, setActiveBroadcastPlayerId] = useState<
    string | null
  >(null);

  useLayoutEffect(() => {
    const prevIds = new Set(prevHandRef.current.map((c) => c.cardId));
    const newCards = hand.filter((c) => !prevIds.has(c.cardId));

    if (newCards.length > 0 && deckRef.current && handRef.current) {
      const deckRect = deckRef.current.getBoundingClientRect();
      const handRect = handRef.current.getBoundingClientRect();

      // All coordinates are relative to the hand wrapper so the flying card
      // lives in the same stacking context as the fan cards.
      // Anchor on the card's bottom edge (deckRef points to the card element,
      // whose getBoundingClientRect reflects Center's projected position).
      // The tilt layer uses transformOrigin "bottom center", so anchoring
      // startY at bottom-144 keeps the visual bottom flush with the deck card.
      const startX = deckRect.left + (deckRect.width - 96) / 2 - handRect.left;
      const startY = deckRect.bottom - 144 - handRect.top;

      setHiddenCardIds((prev) => {
        const next = new Set(prev);
        newCards.forEach((c) => next.add(c.cardId));
        return next;
      });

      const prevHandSize = prevHandRef.current.length;
      const totalHandSize = hand.length;
      const center = (totalHandSize - 1) / 2;

      setFlyingCards((prev) => [
        ...prev,
        ...newCards.map((card, i) => {
          const cardEl = cardRefs.current.get(card.cardId);
          const cardRect = cardEl?.getBoundingClientRect();
          const targetX =
            (cardRect?.left ?? handRect.left + handRect.width / 2 - 48) -
            handRect.left;
          const targetY =
            (cardRect?.top ?? handRect.bottom - 190) - handRect.top;
          // Mirror FanLayout's z-index formula so each flying card sits in
          // the correct stacking order relative to existing and sibling cards.
          const handIndex = prevHandSize + i;
          const zIndex = totalHandSize - handIndex;
          // Mirror FanLayout's rotation formula so the card tilts into its fan
          // slot during the final phase of the animation, eliminating the snap.
          const targetRotate = (handIndex - center) * 4;
          return {
            id: card.cardId,
            card,
            startX,
            startY,
            targetX,
            targetY,
            index: i,
            zIndex,
            targetRotate,
          };
        }),
      ]);
    }

    prevHandRef.current = hand;
  }, [hand]);

  useLayoutEffect(() => {
    const prevIds = new Set(
      prevCenterCardsForTurnRef.current.map((c) => c.cardId),
    );
    const newCards = centerCards.filter((c) => !prevIds.has(c.cardId));

    if (newCards.length > 0 && deckRef.current) {
      const deckRect = deckRef.current.getBoundingClientRect();
      // deckRect.width ≈ 96 * tableScale * 1.08 (Center's scaleX).
      // Dividing by (96 * 1.08) recovers the Table CSS scale so the flying
      // card matches the visual size of the card sitting in the pile.
      const cardScale = deckRect.width / (96 * 1.08);
      const scaledW = 96 * cardScale;
      const scaledH = 144 * cardScale;
      const startX = deckRect.left + (deckRect.width - scaledW) / 2;
      const startY = deckRect.bottom - scaledH;

      setHiddenCenterCardIds((prev) => {
        const next = new Set(prev);
        newCards.forEach((c) => next.add(c.cardId));
        return next;
      });

      setTurnOverFlyingCards((prev) => [
        ...prev,
        ...newCards.map((card, i) => {
          const cardEl = cardRefs.current.get(card.cardId);
          const cardRect = cardEl?.getBoundingClientRect();
          return {
            id: card.cardId,
            card,
            startX,
            startY,
            // Anchor to the real card's visual bounding rect (already perspective-
            // projected by the Center container). Bottom-anchor so the flat flying
            // card's bottom aligns with the tilted slot's bottom. Center X on the
            // visually wider (scaleX 1.08) card so there's no horizontal jump.
            targetX: cardRect
              ? cardRect.left + (cardRect.width - scaledW) / 2
              : startX,
            targetY: cardRect ? cardRect.bottom - scaledH : startY,
            index: i,
            cardScale,
          };
        }),
      ]);
    }

    prevCenterCardsForTurnRef.current = centerCards;
  }, [centerCards]);

  useLayoutEffect(() => {
    const prevPlayers = prevPlayersRef.current;
    const prevCenterCards = prevCenterCardsRef.current;
    const prevCenterRects = prevCenterCardRectsRef.current;

    // Which center card names were removed this update?
    const currentCenterIds = new Set(centerCards.map((c) => c.cardId));
    const removedCenterNames = new Set(
      prevCenterCards
        .filter((c) => !currentCenterIds.has(c.cardId))
        .map((c) => c.cardName),
    );

    const newFlying: PlantFlyingCardEntry[] = [];

    players.forEach((player, playerIndex) => {
      const prevPlayer = prevPlayers.find(
        (p) => p.playerId === player.playerId,
      );
      const fieldRotation = getFieldRotation(playerIndex, players.length);
      player.playerField.slots.forEach((slot) => {
        const prevSlot = prevPlayer?.playerField.slots.find(
          (s) => s.slotId === slot.slotId,
        );
        const prevCount = prevSlot?.cardIds.length ?? 0;
        if (slot.cardIds.length <= prevCount || !slot.cardName) return;

        const slotEl = opponentSlotRefs.current.get(slot.slotId);
        if (!slotEl) return;
        const slotRect = slotEl.getBoundingClientRect();

        let startX: number;
        let startY: number;
        let initialScale = 1;

        if (removedCenterNames.has(slot.cardName)) {
          // Card came from center — use its last-known position
          const centerPos = prevCenterRects.get(slot.cardName);
          if (centerPos) {
            startX = centerPos.left;
            startY = centerPos.top;
          } else {
            // Fallback: deck position
            const deckRect = deckRef.current?.getBoundingClientRect();
            startX = (deckRect?.left ?? 0) + ((deckRect?.width ?? 96) - 96) / 2;
            startY =
              (deckRect?.top ?? 0) + ((deckRect?.height ?? 144) - 144) / 2;
          }
        } else {
          // Card came from hand — use hand container center
          const handEl = opponentHandContainerRefs.current.get(player.playerId);
          if (handEl) {
            const handRect = handEl.getBoundingClientRect();
            startX = handRect.left + handRect.width / 2 - 48;
            startY = handRect.top + handRect.height / 2 - 72;
          } else {
            const deckRect = deckRef.current?.getBoundingClientRect();
            startX = (deckRect?.left ?? 0) + ((deckRect?.width ?? 96) - 96) / 2;
            startY =
              (deckRect?.top ?? 0) + ((deckRect?.height ?? 144) - 144) / 2;
          }
          initialScale = 0.28;
        }

        const fromHand = initialScale === 0.28;
        // Only hide the slot while animating when the slot was previously empty.
        newFlying.push({
          id: `${slot.slotId}-${slot.cardIds.length}`,
          card: cardLookup.get(slot.cardName) ?? {
            cardId: slot.cardIds.at(-1)!,
            cardName: slot.cardName,
            backImage: "",
            cardQuantity: 0,
            frontImage: "",
            money_exchange: {},
          },
          startX,
          startY,
          targetX: slotRect.left + (slotRect.width - 96) / 2,
          targetY: slotRect.top + (slotRect.height - 144) / 2,
          // Center plants: 2D spin to match the rotated slot orientation,
          // including the field container's own rotation.
          // Hand plants: card stays at the slot's final orientation throughout;
          // the scale animation provides the visual motion.
          ...(!fromHand
            ? {
                targetRotate: fieldRotation,
                targetRotateX: 25,
                targetScaleX: 1.08,
                targetScale: 0.75,
              }
            : {
                initialRotate: fieldRotation,
                targetRotateX: 25,
                targetScaleX: 1.08,
                targetScale: 0.75,
              }),
          initialScale,
          opponentSlotId: slot.slotId,
          slotWasEmpty: prevCount === 0,
        });
      });
    });

    if (newFlying.length > 0) {
      // Call setters directly (not via startTransition) so React processes
      // both updates synchronously inside this layout effect — before the
      // browser paints. This prevents the one-frame flicker where the card
      // appears in the slot before the flying animation begins.
      setPlantFlyingCards((prev) => [...prev, ...newFlying]);
      setAnimatingOpponentSlotIds((prev) => {
        const next = new Set(prev);
        newFlying.forEach((e) => {
          if (e.slotWasEmpty) next.add(e.opponentSlotId!);
        });
        return next;
      });
    }

    // Update snapshots for next run
    prevPlayersRef.current = players;
    prevCenterCardsRef.current = centerCards;
    const newRects = new Map<string, { left: number; top: number }>();
    centerCards.forEach((card) => {
      const el = cardRefs.current.get(card.cardId);
      if (el) {
        const r = el.getBoundingClientRect();
        newRects.set(card.cardName, { left: r.left, top: r.top });
      }
    });
    prevCenterCardRectsRef.current = newRects;
  }, [players, centerCards, cardLookup]);

  useLayoutEffect(() => {
    const prevField = prevFieldRef.current;
    const newFlying: PlantFlyingCardEntry[] = [];

    field.slots.forEach((slot) => {
      const prevSlot = prevField.slots.find((s) => s.slotId === slot.slotId);
      const prevCount = prevSlot?.cardIds.length ?? 0;
      if (slot.cardIds.length <= prevCount || !slot.cardName) return;

      const slotEl = mySlotRefs.current.get(slot.slotId);
      if (!slotEl) return;
      const slotRect = slotEl.getBoundingClientRect();

      const newCardId = slot.cardIds.at(-1);
      if (newCardId && dragPlantedCardIds.current.has(newCardId)) {
        dragPlantedCardIds.current.delete(newCardId);
        return;
      }

      const handPos = newCardId
        ? prevHandCardRectsRef.current.get(newCardId)
        : undefined;
      const centerPos = snapshotCenterRects.current.get(slot.cardName);
      const startPos = handPos ?? centerPos;
      if (!startPos) return;

      // Use the projected card rect if available so we can bottom-anchor the
      // flying card (transformOrigin "bottom center") exactly like TurnOverFlyingCard.
      const cardEl = mySlotCardRefs.current.get(slot.slotId);
      const cardRect = cardEl?.getBoundingClientRect();
      const targetX = cardRect
        ? cardRect.left + (cardRect.width - 96 * 1.08) / 2
        : slotRect.left + (slotRect.width - 96) / 2;
      const targetY = cardRect
        ? cardRect.bottom - 144
        : slotRect.top + (slotRect.height - 144) / 2;

      newFlying.push({
        id: `my-${slot.slotId}-${slot.cardIds.length}`,
        card: cardLookup.get(slot.cardName) ?? {
          cardId: newCardId ?? "",
          cardName: slot.cardName,
          backImage: "",
          cardQuantity: 0,
          frontImage: "",
          money_exchange: {},
        },
        startX: startPos.left,
        startY: startPos.top,
        targetX,
        targetY,
        targetRotateX: 25,
        targetScaleX: 1.08,
        opponentSlotId: slot.slotId,
        slotWasEmpty: prevCount === 0,
      });
    });

    if (newFlying.length > 0) {
      setPlantFlyingCards((prev) => [...prev, ...newFlying]);
      setAnimatingOpponentSlotIds((prev) => {
        const next = new Set(prev);
        newFlying.forEach((e) => {
          if (e.slotWasEmpty) next.add(e.opponentSlotId!);
        });
        return next;
      });
    }

    prevFieldRef.current = field;
  }, [field, cardLookup]);

  const handleFlyComplete = useCallback((cardId: string) => {
    setFlyingCards((prev) => prev.filter((fc) => fc.id !== cardId));
    setHiddenCardIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  const handleTurnOverComplete = useCallback((id: string) => {
    setTurnOverFlyingCards((prev) => prev.filter((fc) => fc.id !== id));
    setHiddenCenterCardIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handlePlantComplete = useCallback(
    (id: string, opponentSlotId?: string) => {
      setPlantFlyingCards((prev) => prev.filter((fc) => fc.id !== id));
      if (opponentSlotId) {
        setAnimatingOpponentSlotIds((prev) => {
          const next = new Set(prev);
          next.delete(opponentSlotId);
          return next;
        });
      }
    },
    [],
  );

  // ── Inline modal (drag-to-request) ───────────────────────────────────────────
  const handleRequestDrop = useCallback(
    (cards: CardType[]) => {
      const target = myPlayerId !== playerTurn ? playerTurn : undefined;
      openInlineModal({ cardsRequested: cards });
      setDraftState({ requested: cards, offered: [], targetId: target });
    },
    [myPlayerId, playerTurn],
  );

  const handleOpenModal = useCallback(() => {
    openInlineModal({ cardsRequested: [] });
    setDraftState({ requested: [], offered: [], targetId: undefined });
    setShowReqPicker(true);
  }, []);

  useEffect(() => {
    if (!playerDropResult) return;
    const { player, cards } = playerDropResult;
    openInlineModal({
      cardsRequested: [],
      defaultOfferedCards: cards,
      defaultTargetId: player.playerId,
    });
    setDraftState({ requested: [], offered: cards, targetId: player.playerId });
    clearPlayerDropResult();
  }, [playerDropResult, clearPlayerDropResult]);

  // Draft arrow paths for the in-progress inline modal offer.
  const [draftPaths, setDraftPaths] = useState<Map<string, OfferPathEntry>>(
    new Map(),
  );
  const [activeDraftBroadcastPlayerId, setActiveDraftBroadcastPlayerId] =
    useState<string | null>(null);

  useEffect(() => {
    if (!draftState || !tradedCardsAreaRef.current) {
      setDraftPaths(new Map());
      return;
    }

    const computeDraftPaths = () => {
      if (!tradedCardsAreaRef.current) return;
      const next = new Map<string, OfferPathEntry>();
      const crefs = cardRefs.current;
      const tagEl = counteringOffer
        ? (tagWrapperRefs.current.get("__draft__") ??
          tradedCardsAreaRef.current)
        : (draftCardsGroupRef.current ?? tradedCardsAreaRef.current);
      const oHandRefs = opponentHandContainerRefs.current;
      const oFieldRefs = opponentFieldRefs.current;

      const isBroadcast = !draftState.targetId;
      const color = isBroadcast ? ORIGIN_COLORS.player : ORIGIN_COLORS.hand;

      // Receiving arrows: per-card.
      // Non-turn player + center card → specific card element.
      // Everything else → opponent hand container.
      const centerIdSet = new Set(centerCards.map((c) => c.cardId));
      const seenRecv = new Set<HTMLElement>();
      let ri = 0;

      for (const card of draftState.requested) {
        if (!isTurnPlayer && centerIdSet.has(card.cardId)) {
          const el = crefs.get(card.cardId) ?? centerCardsRef.current;
          if (el && !seenRecv.has(el)) {
            seenRecv.add(el);
            addPath(next, `draft_r_${ri++}`, el, tagEl, color);
          }
        } else if (isBroadcast) {
          players
            .filter((p) => p.playerId !== myPlayerId)
            .forEach((p) => {
              const el =
                oHandRefs.get(p.playerId) ?? oFieldRefs.get(p.playerId) ?? null;
              if (el && !seenRecv.has(el)) {
                seenRecv.add(el);
                addPath(next, `draft_r_${ri++}`, el, tagEl, color, p.playerId);
              }
            });
        } else {
          const el =
            oHandRefs.get(draftState.targetId!) ??
            oFieldRefs.get(draftState.targetId!) ??
            null;
          if (el && !seenRecv.has(el)) {
            seenRecv.add(el);
            addPath(next, `draft_r_${ri++}`, el, tagEl, color);
          }
        }
      }

      // Giving arrows: offered card elements → target opponent field(s)
      const seenOffer = new Set<HTMLElement>();
      let oi = 0;
      draftState.offered.forEach((card) => {
        const offEl = crefs.get(card.cardId) ?? null;
        if (!offEl || seenOffer.has(offEl)) return;
        seenOffer.add(offEl);
        if (isBroadcast) {
          players
            .filter((p) => p.playerId !== myPlayerId)
            .forEach((p) => {
              const targetEl = oFieldRefs.get(p.playerId) ?? null;
              if (targetEl)
                addPath(
                  next,
                  `draft_o_${oi++}`,
                  offEl,
                  targetEl,
                  ORIGIN_COLORS.player,
                  p.playerId,
                );
            });
        } else {
          const targetEl = oFieldRefs.get(draftState.targetId!) ?? null;
          if (targetEl)
            addPath(next, `draft_o_${oi++}`, offEl, targetEl, color);
        }
      });

      setDraftPaths(next);
    };

    computeDraftPaths();
    window.addEventListener("resize", computeDraftPaths);
    return () => window.removeEventListener("resize", computeDraftPaths);
  }, [
    draftState,
    counteringOffer,
    players,
    myPlayerId,
    isTurnPlayer,
    centerCards,
  ]);

  // Rotate broadcast player highlight for draft arrows (mirrors offer broadcast rotation).
  useEffect(() => {
    if (!draftState || draftState.targetId) {
      setActiveDraftBroadcastPlayerId(null);
      return;
    }
    const otherPlayerIds = players
      .filter((p) => p.playerId !== myPlayerId)
      .map((p) => p.playerId);
    if (otherPlayerIds.length === 0) return;
    setActiveDraftBroadcastPlayerId(otherPlayerIds[0]);
    if (otherPlayerIds.length === 1) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % otherPlayerIds.length;
      setActiveDraftBroadcastPlayerId(otherPlayerIds[idx]);
    }, 1200);
    return () => clearInterval(interval);
  }, [draftState, players, myPlayerId]);

  // Snapshot hand and center card positions after every render so the next
  // render's field-change effect can use them as animation start positions.
  useLayoutEffect(() => {
    const handRects = new Map<string, { left: number; top: number }>();
    hand.forEach((card) => {
      const el = cardRefs.current.get(card.cardId);
      if (el) {
        const r = el.getBoundingClientRect();
        handRects.set(card.cardId, { left: r.left, top: r.top });
      }
    });
    prevHandCardRectsRef.current = handRects;

    const centerRects = new Map<string, { left: number; top: number }>();
    centerCards.forEach((card) => {
      const el = cardRefs.current.get(card.cardId);
      if (el) {
        const r = el.getBoundingClientRect();
        centerRects.set(card.cardName, { left: r.left, top: r.top });
      }
    });
    snapshotCenterRects.current = centerRects;
  });

  // ── Offer origin arrow paths ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "turnTrade") {
      setOfferPaths(new Map());
      return;
    }

    const computePaths = () => {
      const next = new Map<string, OfferPathEntry>();
      const crefs = cardRefs.current;
      const oFieldRefs = opponentFieldRefs.current;
      const oHandRefs = opponentHandContainerRefs.current;

      offers
        .filter(
          (o) =>
            o.status === "pending" &&
            (o.creator_id === myPlayerId ||
              ((o.target_id === myPlayerId || o.target_id === "") &&
                o.creator_id !== myPlayerId)),
        )
        .forEach((offer) => {
          const isOutgoing = offer.creator_id === myPlayerId;
          const tagEl = getTagEl(offer, tagWrapperRefs.current);
          if (!tagEl) return;
          const isBroadcast = offer.target_id === "";
          const isBlocked = isOutgoing
            ? !canProvideOfferedCards(offer, hand, centerCards, isTurnPlayer)
            : !canAcceptOffer(offer, hand, centerCards, isTurnPlayer);
          const color = isBlocked
            ? ORIGIN_COLORS.blocked
            : isBroadcast
              ? ORIGIN_COLORS.player
              : isOutgoing
                ? ORIGIN_COLORS.hand
                : ORIGIN_COLORS.center;
          const targets = isBroadcast
            ? broadcastTargets(offer, players, myPlayerId)
            : null;

          // Receiving arrows: one per unique source element → tag.
          const seenRecv = new Set<HTMLElement>();
          let ri = 0;
          if (isOutgoing && isBroadcast) {
            targets!.forEach((p) => {
              const el =
                oHandRefs.get(p.playerId) ?? oFieldRefs.get(p.playerId) ?? null;
              if (el && !seenRecv.has(el)) {
                seenRecv.add(el);
                addPath(
                  next,
                  `${offer.id}_r_${ri++}`,
                  el,
                  tagEl,
                  color,
                  p.playerId,
                );
              }
            });
          } else {
            const peerId = isOutgoing ? offer.target_id : offer.creator_id;
            const fallbackEl = oHandRefs.get(peerId) ?? null;
            const recvCards = isOutgoing
              ? offer.cards_requested
              : offer.cards_offered;
            for (const c of recvCards) {
              const inCenter = !!(
                c.card_id && centerCards.some((cc) => cc.cardId === c.card_id)
              );
              const el = inCenter
                ? (crefs.get(c.card_id) ?? centerCardsRef.current)
                : fallbackEl;
              if (el && !seenRecv.has(el)) {
                seenRecv.add(el);
                addPath(next, `${offer.id}_r_${ri++}`, el, tagEl, color);
              }
            }
          }

          // Offering arrows: one per unique source element → destination field.
          if (isOutgoing) {
            offer.cards_offered.forEach((c, i) => {
              const offEl = resolveOfferedEl(
                c,
                centerCards,
                crefs,
                centerCardsRef.current,
                hand,
              );
              if (!offEl) return;
              if (isBroadcast) {
                addPathsToTargets(
                  next,
                  oFieldRefs,
                  `${offer.id}_o_${i}`,
                  offEl,
                  targets!,
                  color,
                );
              } else {
                const targetEl = oFieldRefs.get(offer.target_id) ?? null;
                if (targetEl)
                  addPath(next, `${offer.id}_o_${i}`, offEl, targetEl, color);
              }
            });
          } else {
            const creatorEl = oFieldRefs.get(offer.creator_id) ?? null;
            if (creatorEl) {
              const claimed = new Set<string>();
              const seenOffer = new Set<HTMLElement>();
              let oi = 0;
              for (const c of offer.cards_requested) {
                const offEl =
                  (isTurnPlayer
                    ? claimCard(
                        centerCards,
                        c,
                        claimed,
                        centerCardsRef.current,
                        crefs,
                      )
                    : null) ??
                  claimCard(hand, c, claimed, handRef.current, crefs);
                if (offEl && !seenOffer.has(offEl)) {
                  seenOffer.add(offEl);
                  addPath(
                    next,
                    `${offer.id}_o_${oi++}`,
                    offEl,
                    creatorEl,
                    color,
                  );
                }
              }
            }
          }
        });

      // Ghost card arrows: blocked paths from missing cards → destination field(s).
      if (hoveredOfferId && ghostCards.length > 0) {
        const hoveredOffer = offers.find((o) => o.id === hoveredOfferId);
        if (hoveredOffer) {
          const isBroadcastGhost = hoveredOffer.target_id === "";
          const targets = isBroadcastGhost
            ? broadcastTargets(hoveredOffer, players, myPlayerId)
            : null;
          const destEl =
            hoveredOffer.creator_id === myPlayerId
              ? (oFieldRefs.get(hoveredOffer.target_id) ?? null)
              : (oFieldRefs.get(hoveredOffer.creator_id) ?? null);

          ghostCards.forEach((ghost, i) => {
            const ghostEl = crefs.get(ghost.cardId);
            if (!ghostEl) return;
            if (isBroadcastGhost && targets) {
              addPathsToTargets(
                next,
                oFieldRefs,
                `${hoveredOfferId}_ghost_${i}`,
                ghostEl,
                targets,
                ORIGIN_COLORS.blocked,
              );
            } else if (destEl) {
              addPath(
                next,
                `${hoveredOfferId}_ghost_${i}`,
                ghostEl,
                destEl,
                ORIGIN_COLORS.blocked,
              );
            }
          });
        }
      }

      setOfferPaths(next);
    };

    computePaths();
    window.addEventListener("resize", computePaths);
    return () => window.removeEventListener("resize", computePaths);
  }, [
    offers,
    phase,
    myPlayerId,
    centerCards,
    hand,
    hoveredOfferId,
    ghostCards,
    isTurnPlayer,
    players,
  ]);

  // ── Broadcast offer player-rotation effect ───────────────────────────────────
  useEffect(() => {
    if (!hoveredOfferId) {
      setActiveBroadcastPlayerId(null);
      return;
    }
    const hoveredOffer = offers.find(
      (o) =>
        o.id === hoveredOfferId &&
        o.creator_id === myPlayerId &&
        o.target_id === "",
    );
    if (!hoveredOffer) {
      setActiveBroadcastPlayerId(null);
      return;
    }
    // Capture stable snapshot of other player IDs — players array ref changes
    // every render so we intentionally read it once here and omit it from deps.
    // Exclude players who have already rejected the offer.
    const rejectedSet = new Set(hoveredOffer.rejected_by ?? []);
    const otherPlayerIds = players
      .filter((p) => p.playerId !== myPlayerId && !rejectedSet.has(p.playerId))
      .map((p) => p.playerId);
    if (otherPlayerIds.length === 0) return;
    setActiveBroadcastPlayerId(otherPlayerIds[0]);
    if (otherPlayerIds.length === 1) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % otherPlayerIds.length;
      setActiveBroadcastPlayerId(otherPlayerIds[idx]);
    }, 1200);
    return () => clearInterval(interval);
  }, [hoveredOfferId, offers, myPlayerId, players]);

  // A representative card for the draw deck back image.
  // Prefer a real card from the live game state (which carries backImage from the server),
  // but fall back to the first entry in cardLookup so the back image is always available
  // even before any cards have been dealt/discarded.
  const anyCardWithBack: CardType = centerCards[0] ??
    discardTopCard ??
    [...cardLookup.values()][0] ?? {
      cardId: "__deck__",
      cardName: "",
      backImage: "",
    };
  const backImage = [...(cardLookup?.values() ?? [])][0]?.backImage ?? "";

  const handleAcceptOffer = (offer: (typeof offers)[0]) => {
    const requestedCounts: Record<string, number> = {};
    for (const c of offer.cards_requested) {
      requestedCounts[c.card_type] = (requestedCounts[c.card_type] ?? 0) + 1;
    }
    const hasAmbiguity = Object.entries(requestedCounts).some(
      ([cardType, needed]) => {
        const handCount = hand.filter((c) => c.cardName === cardType).length;
        const centerCount = isTurnPlayer
          ? centerCards.filter((c) => c.cardName === cardType).length
          : 0;
        return handCount + centerCount > needed;
      },
    );
    if (hasAmbiguity) {
      setAcceptPickerOffer(offer);
    } else {
      onRespondOffer(offer.id, "accept");
    }
  };

  const outgoingOffer = offers.filter(
    (o) =>
      o.creator_id === myPlayerId &&
      o.parent_offer_id === "" &&
      o.status === "pending",
  );
  const incomingOffer = offers.filter(
    (o) =>
      (o.target_id === myPlayerId || o.target_id === "") &&
      o.creator_id !== myPlayerId &&
      o.parent_offer_id === "" &&
      o.status === "pending",
  );

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#2a1505" }}
    >
      {turnOverFlyingCards.map((fc) => (
        <TurnOverFlyingCard
          key={fc.id}
          card={fc.card}
          startX={fc.startX}
          startY={fc.startY}
          targetX={fc.targetX}
          targetY={fc.targetY}
          index={fc.index}
          cardScale={fc.cardScale}
          onComplete={() => handleTurnOverComplete(fc.id)}
        />
      ))}

      {plantFlyingCards.map((fc) => (
        <PlantFlyingCard
          key={fc.id}
          card={fc.card}
          startX={fc.startX}
          startY={fc.startY}
          targetX={fc.targetX}
          targetY={fc.targetY}
          targetRotateX={fc.targetRotateX}
          targetScaleX={fc.targetScaleX}
          initialRotate={fc.initialRotate}
          targetRotate={fc.targetRotate}
          initialScale={fc.initialScale}
          targetScale={fc.targetScale}
          onComplete={() => handlePlantComplete(fc.id, fc.opponentSlotId)}
        />
      ))}

      {Array.from(offerPaths.entries()).map(
        ([key, { pathStr, color, playerId }]) => {
          let opacity = 0;
          if (hoveredOfferId && key.startsWith(hoveredOfferId)) {
            if (playerId) {
              opacity = playerId === activeBroadcastPlayerId ? 1 : 0.3;
            } else {
              opacity = 1;
            }
          }
          return (
            <Arrow
              key={key}
              pathStr={pathStr}
              color={color}
              opacity={opacity}
            />
          );
        },
      )}

      {Array.from(draftPaths.entries()).map(
        ([key, { pathStr, color, playerId }]) => {
          const opacity = playerId
            ? playerId === activeDraftBroadcastPlayerId
              ? 1
              : 0.3
            : 1;
          return (
            <Arrow
              key={key}
              pathStr={pathStr}
              color={color}
              opacity={opacity}
            />
          );
        },
      )}

      {inlineModal && (
        <InlineModal
          key={inlineModal.key}
          isTurnPlayer={myPlayerId === gameState.playerTurn}
          players={gameState.players.filter((p) => p.playerId !== myPlayerId)}
          getAnchorRect={() =>
            draftCardsGroupRef.current?.getBoundingClientRect() ??
            tradedCardsAreaRef.current?.getBoundingClientRect()
          }
          offeredCards={offeredCards}
          requestedQty={reqQty}
          selectedTargetId={reqTarget}
          onTargetChange={setReqTarget}
          showReqPicker={showReqPicker}
          onToggleReqPicker={setShowReqPicker}
          filteredCatalog={allCatalogCards}
          onAddReqCard={addReqCard}
          onSubmit={(cardsOffered, reqCards, targetPlayerId) => {
            onCreateOffer(
              cardsOffered,
              enrichWithCenterIds(
                reqCards,
                gameState.centerCards,
                myPlayerId === gameState.playerTurn,
              ),
              targetPlayerId,
            );
            setInlineModal(null);
            setDraftState(null);
          }}
          onClose={() => {
            setInlineModal(null);
            setDraftState(null);
          }}
        />
      )}

      <Table>
        <Opponents>
          {players.map((player) => {
            const playerHighlight =
              draftPlayerHighlights.get(player.playerId) ??
              playerHighlights.get(player.playerId);
            return (
              <Player
                key={player.playerId}
                playerId={player.playerId}
                playerName={player.playerName}
                playerAvatar={player.playerAvatar}
                playerStatus="active"
                playerCoins={player.playerCoins}
                playerPickedCardsCount={player.playerPickedCardsCount}
                isCurrentTurn={player.playerId === playerTurn}
                gamePhase={phase}
                isDragTarget={dragOverPlayerId === player.playerId}
                dragBlockMessage={
                  dragOverPlayerId === player.playerId
                    ? (dragOverBlockReason ?? undefined)
                    : undefined
                }
                onDragOver={(e) => handlePlayerDragOver(e, player.playerId)}
                onDragLeave={handlePlayerDragLeave}
                onDrop={(e) => handlePlayerDrop(e, player)}
                field={
                  <div
                    ref={(el) => {
                      if (el)
                        opponentFieldRefs.current.set(player.playerId, el);
                      else opponentFieldRefs.current.delete(player.playerId);
                    }}
                  >
                    <Field>
                      {player.playerField.slots.map((slot, index) => {
                        const cardForSlot = cardLookup.get(slot.cardName ?? "");
                        return (
                          <div
                            key={slot.slotId}
                            ref={(el) => {
                              if (el)
                                opponentSlotRefs.current.set(slot.slotId, el);
                              else opponentSlotRefs.current.delete(slot.slotId);
                            }}
                          >
                            <Slot
                              key={slot.slotId}
                              slot={slot}
                              index={index}
                              interactive={false}
                            >
                              {cardForSlot && (
                                <Card
                                  card={cardForSlot}
                                  flipped={false}
                                  noTransition={true}
                                  onContextMenu={
                                    !counteringOffer
                                      ? () => {
                                          if (phase === "turnTrade")
                                            openInlineModal({
                                              cardsRequested: [cardForSlot],
                                              defaultTargetId: isTurnPlayer
                                                ? player.playerId
                                                : playerTurn,
                                            });
                                        }
                                      : undefined
                                  }
                                  hidden={animatingOpponentSlotIds.has(
                                    slot.slotId,
                                  )}
                                />
                              )}
                            </Slot>
                          </div>
                        );
                      })}
                    </Field>
                  </div>
                }
                hand={
                  <FanLayout
                    variant="opponent"
                    maxCards={12}
                    containerRef={(el) => {
                      if (el)
                        opponentHandContainerRefs.current.set(
                          player.playerId,
                          el,
                        );
                      else
                        opponentHandContainerRefs.current.delete(
                          player.playerId,
                        );
                    }}
                  >
                    {Array.from({ length: player.playerHandSize }).map(
                      (_, index) => (
                        <Card
                          key={index}
                          card={{ backImage }}
                          flipped={true}
                          highlightColor={
                            index < (playerHighlight?.count ?? 0)
                              ? playerHighlight?.color
                              : undefined
                          }
                        />
                      ),
                    )}
                  </FanLayout>
                }
              />
            );
          })}
        </Opponents>

        <Center>
          <CardPile
            label="Draw"
            count={deckSize}
            topCard={anyCardWithBack}
            onClickAction={handleDrawDeckClick}
            deckRef={deckRef}
          />
          <div ref={centerCardsRef}>
            <CenterCards slots={cardsPerTurn ?? 3}>
              {centerCards.map((card) => {
                const isOffered = offeredCards.some(
                  (c) => c.cardId === card.cardId,
                );
                return (
                  <Card
                    key={card.cardId}
                    card={card}
                    ref={(el) => {
                      if (el) cardRefs.current.set(card.cardId, el);
                      else cardRefs.current.delete(card.cardId);
                    }}
                    onDragStart={(e) => handleCardDrag(e, card, "center")}
                    hidden={hiddenCenterCardIds.has(card.cardId)}
                    highlightColor={
                      phase === "turnTrade" &&
                      selection.some((c) => c.cardId === card.cardId)
                        ? "#a855f7"
                        : (draftCardHighlights.get(card.cardId) ??
                          cardHighlights.get(card.cardId))
                    }
                    secondaryHighlightColor={
                      draftCardHighlights.has(card.cardId)
                        ? cardHighlights.get(card.cardId)
                        : undefined
                    }
                    selectHint={
                      (!!inlineModal || !!counteringOffer) &&
                      isTurnPlayer &&
                      !isOffered
                    }
                    isSelected={selection.some((c) => c.cardId === card.cardId)}
                    draggable={!inlineModal && !counteringOffer}
                    onClick={(e: React.MouseEvent) => {
                      if ((inlineModal || counteringOffer) && isTurnPlayer) {
                        setOfferedCards((prev) =>
                          isOffered
                            ? prev.filter((c) => c.cardId !== card.cardId)
                            : [...prev, card],
                        );
                        return;
                      }
                      handleCardClick(card, "center", e.ctrlKey || e.metaKey);
                    }}
                    onContextMenu={
                      !isTurnPlayer && !inlineModal && !counteringOffer
                        ? () => {
                            if (phase === "turnTrade")
                              openInlineModal({
                                cardsRequested: [card],
                                defaultTargetId: playerTurn,
                              });
                          }
                        : undefined
                    }
                  />
                );
              })}
            </CenterCards>
          </div>
          <CardPile
            label="Discard"
            count={discardPileSize}
            topCard={discardTopCard}
          />
        </Center>
      </Table>

      <CurrentPlayer
        coinCount={coins}
        field={
          <Field>
            {field.slots.map((s: SlotType, index: number) => {
              const cardForSlot = s.cardName
                ? (cardLookup.get(s.cardName) ?? null)
                : null;
              const highlightEmpty = selection.length === 1;
              return (
                <div
                  key={s.slotId}
                  ref={(el) => {
                    if (el) mySlotRefs.current.set(s.slotId, el);
                    else mySlotRefs.current.delete(s.slotId);
                  }}
                >
                  <Slot
                    slot={s}
                    index={index}
                    dragOverSlot={dragOverSlot}
                    highlightEmpty={highlightEmpty}
                    handleDragOver={handleSlotDragOver}
                    handleDragLeave={handleSlotDragLeave}
                    handleSlotDrop={handleSlotDrop}
                    handleSlotClick={handleSlotClick}
                  >
                    {cardForSlot && (
                      <Card
                        card={cardForSlot}
                        flipped={false}
                        ref={(el) => {
                          if (el) mySlotCardRefs.current.set(s.slotId, el);
                          else mySlotCardRefs.current.delete(s.slotId);
                        }}
                        hidden={animatingOpponentSlotIds.has(s.slotId)}
                        onContextMenu={
                          !counteringOffer
                            ? () => {
                                if (phase === "turnTrade")
                                  openInlineModal({
                                    cardsRequested: [cardForSlot],
                                    defaultTargetId: isTurnPlayer
                                      ? undefined
                                      : playerTurn,
                                  });
                              }
                            : undefined
                        }
                      />
                    )}
                  </Slot>
                </div>
              );
            })}
          </Field>
        }
        tradedCards={
          <div ref={tradedCardsAreaRef}>
            <TradedCardsArea
              phase={phase}
              pickedCards={pickedCards}
              incomingOffers={incomingOffer}
              outgoingOffers={outgoingOffer}
              onOfferHover={setHoveredOfferId}
              tagWrapperRefs={tagWrapperRefs}
              allOffers={allOffersWithGhost}
              myPlayerId={myPlayerId}
              cardLookup={cardLookup}
              hand={hand}
              centerCards={centerCards}
              isTurnPlayer={isTurnPlayer}
              onRespondOffer={onRespondOffer}
              onAcceptOffer={handleAcceptOffer}
              onCounterOffer={(offer) => {
                setCounteringOffer(offer);
              }}
              selection={selection}
              clearSelection={clearSelection}
              onRequestDrop={handleRequestDrop}
              onOpenModal={handleOpenModal}
              draftCards={inlineModal ? draftState?.requested : undefined}
              draftCardsGroupRef={draftCardsGroupRef}
              draftColor={draftColor}
              isEditingDraft={!!inlineModal}
              reqQty={reqQty}
              onAdjustReq={adjustReqQty}
              onRemoveReq={removeReqQty}
              showReqPicker={showReqPicker}
              onToggleReqPicker={setShowReqPicker}
              onCancelDraft={() => {
                setInlineModal(null);
                setDraftState(null);
              }}
              onToggleDraftPicker={
                counteringOffer ? () => setShowReqPicker((v) => !v) : undefined
              }
              onDraftAdjustReq={counteringOffer ? adjustReqQty : undefined}
              onDraftRemoveReq={counteringOffer ? removeReqQty : undefined}
              onDraftCancel={
                counteringOffer ? () => setCounteringOffer(null) : undefined
              }
            />
          </div>
        }
        hand={
          <div ref={handRef} style={{ position: "relative" }}>
            {flyingCards.map((fc) => (
              <FlyingCard
                key={fc.id}
                card={fc.card}
                startX={fc.startX}
                startY={fc.startY}
                targetX={fc.targetX}
                targetY={fc.targetY}
                index={fc.index}
                zIndex={fc.zIndex}
                targetRotate={fc.targetRotate}
                onComplete={() => handleFlyComplete(fc.id)}
              />
            ))}
            <FanLayout phase={phase}>
              {hand.map((card) => {
                const isOffered = offeredCards.some(
                  (c) => c.cardId === card.cardId,
                );
                return (
                  <Card
                    key={card.cardId}
                    ref={(el) => {
                      if (el) cardRefs.current.set(card.cardId, el);
                      else cardRefs.current.delete(card.cardId);
                    }}
                    card={card}
                    isSelected={selection.some((c) => c.cardId === card.cardId)}
                    hidden={hiddenCardIds.has(card.cardId)}
                    highlightColor={
                      phase === "turnTrade" &&
                      selection.some((c) => c.cardId === card.cardId)
                        ? "#a855f7"
                        : (draftCardHighlights.get(card.cardId) ??
                          cardHighlights.get(card.cardId))
                    }
                    secondaryHighlightColor={
                      draftCardHighlights.has(card.cardId)
                        ? cardHighlights.get(card.cardId)
                        : undefined
                    }
                    selectHint={
                      (!!inlineModal || !!counteringOffer) && !isOffered
                    }
                    draggable={
                      phase !== "plantTrade" && !inlineModal && !counteringOffer
                    }
                    onDragStart={(e) => handleCardDrag(e, card, "hand")}
                    onClick={(e: React.MouseEvent) => {
                      if (inlineModal || counteringOffer) {
                        setOfferedCards((prev) =>
                          isOffered
                            ? prev.filter((c) => c.cardId !== card.cardId)
                            : [...prev, card],
                        );
                        return;
                      }
                      handleCardClick(card, "hand", e.ctrlKey || e.metaKey);
                    }}
                    onContextMenu={
                      !inlineModal && !counteringOffer
                        ? () => {
                            if (phase === "turnTrade")
                              openInlineModal({
                                cardsRequested: [card],
                                defaultTargetId: isTurnPlayer
                                  ? undefined
                                  : playerTurn,
                              });
                          }
                        : undefined
                    }
                  />
                );
              })}
              {ghostCards.map((ghost) => (
                <Card
                  key={ghost.cardId}
                  card={ghost}
                  ref={(el) => {
                    if (el) cardRefs.current.set(ghost.cardId, el);
                    else cardRefs.current.delete(ghost.cardId);
                  }}
                  draggable={false}
                  noRaise
                  highlightColor={ORIGIN_COLORS.blocked}
                  style={{ opacity: 0.4 }}
                />
              ))}
            </FanLayout>
          </div>
        }
      />

      {acceptPickerOffer && (
        <AcceptCardPicker
          offer={acceptPickerOffer}
          hand={hand}
          centerCards={centerCards}
          isTurnPlayer={isTurnPlayer}
          cardLookup={cardLookup}
          onConfirm={(cardsToGive) => {
            onRespondOffer(acceptPickerOffer.id, "accept", cardsToGive);
            setAcceptPickerOffer(null);
          }}
          onClose={() => setAcceptPickerOffer(null)}
        />
      )}

      {counteringOffer && (
        <InlineModal
          key={counteringOffer.id}
          isTurnPlayer={isTurnPlayer}
          players={[]}
          getAnchorRect={() =>
            tagWrapperRefs.current.get("__draft__")?.getBoundingClientRect()
          }
          offeredCards={offeredCards}
          requestedQty={reqQty}
          selectedTargetId={reqTarget}
          onTargetChange={setReqTarget}
          showReqPicker={showReqPicker}
          onToggleReqPicker={setShowReqPicker}
          filteredCatalog={allCatalogCards}
          onAddReqCard={addReqCard}
          hideTargetPicker
          onSubmit={(cardsOffered, reqCards) => {
            onCounterOffer(
              counteringOffer.id,
              cardsOffered,
              enrichWithCenterIds(
                reqCards,
                gameState.centerCards,
                isTurnPlayer,
              ),
            );
            setCounteringOffer(null);
          }}
          onClose={() => setCounteringOffer(null)}
        />
      )}
    </div>
  );
}
