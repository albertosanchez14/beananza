"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type React from "react";
import { CardType, ExternalPlayer, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";
import { useGameContext } from "@/components/game-context";

type Props = {
  cardsRequested: CardType[];
  myHand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  players: ExternalPlayer[];
  defaultTargetId?: string;
  defaultOfferedCards?: CardType[];
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onDraftChange: (
    requested: CardType[],
    offered: CardType[],
    targetId: string | undefined,
  ) => void;
  onSubmit: (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId: string | undefined,
  ) => void;
  onClose: () => void;
};

type CardGroup = {
  cardName: string;
  display: CardType;
  available: CardType[];
};

function buildGroups(
  cards: CardType[],
  cardLookup: Map<string, CardType>,
): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const card of cards) {
    if (!map.has(card.cardName)) {
      map.set(card.cardName, {
        cardName: card.cardName,
        display: cardLookup.get(card.cardName) ?? card,
        available: [],
      });
    }
    map.get(card.cardName)!.available.push(card);
  }
  return Array.from(map.values());
}

export default function InlineModal({
  cardsRequested,
  myHand,
  centerCards,
  isTurnPlayer,
  players,
  defaultTargetId,
  defaultOfferedCards,
  anchorRef,
  onDraftChange,
  onSubmit,
  onClose,
}: Props) {
  const { cardLookup } = useGameContext();

  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(
    defaultTargetId,
  );
  const [requestedQty, setRequestedQty] = useState<Record<string, number>>(
    () => {
      const init: Record<string, number> = {};
      for (const c of cardsRequested) {
        init[c.cardName] = (init[c.cardName] ?? 0) + 1;
      }
      return init;
    },
  );
  const [offeredHandQty, setOfferedHandQty] = useState<Record<string, number>>(
    () => {
      if (!defaultOfferedCards) return {};
      const handIds = new Set(myHand.map((c) => c.cardId));
      const init: Record<string, number> = {};
      for (const c of defaultOfferedCards) {
        if (handIds.has(c.cardId))
          init[c.cardName] = (init[c.cardName] ?? 0) + 1;
      }
      return init;
    },
  );
  const [offeredCenterQty, setOfferedCenterQty] = useState<
    Record<string, number>
  >(() => {
    if (!defaultOfferedCards) return {};
    const centerIds = new Set(centerCards.map((c) => c.cardId));
    const init: Record<string, number> = {};
    for (const c of defaultOfferedCards) {
      if (centerIds.has(c.cardId))
        init[c.cardName] = (init[c.cardName] ?? 0) + 1;
    }
    return init;
  });

  const [showRequestPicker, setShowRequestPicker] = useState(false);
  const [showOfferPicker, setShowOfferPicker] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");

  const handGroups = useMemo(
    () => buildGroups(myHand, cardLookup),
    [myHand, cardLookup],
  );
  const centerGroups = useMemo(
    () =>
      isTurnPlayer && centerCards.length > 0
        ? buildGroups(centerCards, cardLookup)
        : [],
    [centerCards, cardLookup, isTurnPlayer],
  );

  const allCatalogCards = useMemo(
    () =>
      Array.from(cardLookup.values()).sort((a, b) =>
        a.cardName.localeCompare(b.cardName),
      ),
    [cardLookup],
  );

  const totalRequested = Object.values(requestedQty).reduce(
    (s, n) => s + n,
    0,
  );

  // ── Draft change callback ────────────────────────────────────────────────────
  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  });

  const resolvedRequested = useMemo(() => {
    const result: CardType[] = [];
    for (const [name, qty] of Object.entries(requestedQty)) {
      const pool = [
        ...centerCards.filter((c) => c.cardName === name),
        ...myHand.filter((c) => c.cardName === name),
      ];
      for (let i = 0; i < qty; i++) {
        const card = pool[i] ?? cardLookup.get(name);
        if (card) result.push(card);
      }
    }
    return result;
  }, [requestedQty, myHand, centerCards, cardLookup]);

  const resolvedOffered = useMemo(() => {
    const result: CardType[] = [];
    for (const group of handGroups) {
      const qty = offeredHandQty[group.cardName] ?? 0;
      result.push(...group.available.slice(0, qty));
    }
    for (const group of centerGroups) {
      const qty = offeredCenterQty[group.cardName] ?? 0;
      result.push(...group.available.slice(0, qty));
    }
    return result;
  }, [handGroups, centerGroups, offeredHandQty, offeredCenterQty]);

  useEffect(() => {
    onDraftChangeRef.current(resolvedRequested, resolvedOffered, selectedTargetId);
  }, [resolvedRequested, resolvedOffered, selectedTargetId]);

  // ── Keyboard close ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Adjusters ────────────────────────────────────────────────────────────────
  const adjustRequested = (cardName: string, delta: number) => {
    setRequestedQty((prev) => {
      const current = prev[cardName] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0 && totalRequested <= 1) return prev;
      if (next === 0) {
        const rest = { ...prev };
        delete rest[cardName];
        return rest;
      }
      return { ...prev, [cardName]: next };
    });
  };

  const removeRequested = (cardName: string) => {
    setRequestedQty((prev) => {
      if (Object.keys(prev).length <= 1) return prev;
      const rest = { ...prev };
      delete rest[cardName];
      return rest;
    });
  };

  const adjustOffered = (
    cardName: string,
    delta: number,
    source: "hand" | "center",
  ) => {
    const setQty = source === "hand" ? setOfferedHandQty : setOfferedCenterQty;
    const groups = source === "hand" ? handGroups : centerGroups;
    setQty((prev) => {
      const max =
        groups.find((g) => g.cardName === cardName)?.available.length ?? 0;
      const next = Math.max(0, Math.min(max, (prev[cardName] ?? 0) + delta));
      if (next === 0) {
        const rest = { ...prev };
        delete rest[cardName];
        return rest;
      }
      return { ...prev, [cardName]: next };
    });
  };

  const removeOffered = (cardName: string, source: "hand" | "center") => {
    const setQty = source === "hand" ? setOfferedHandQty : setOfferedCenterQty;
    setQty((prev) => {
      const rest = { ...prev };
      delete rest[cardName];
      return rest;
    });
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const cardsOffered: OfferCard[] = [];
    for (const group of handGroups) {
      const qty = offeredHandQty[group.cardName] ?? 0;
      for (let i = 0; i < qty; i++) {
        cardsOffered.push({
          card_type: group.cardName,
          card_id: group.available[i].cardId,
        });
      }
    }
    for (const group of centerGroups) {
      const qty = offeredCenterQty[group.cardName] ?? 0;
      for (let i = 0; i < qty; i++) {
        cardsOffered.push({
          card_type: group.cardName,
          card_id: group.available[i].cardId,
        });
      }
    }
    const reqCards: OfferCard[] = [];
    for (const [name, qty] of Object.entries(requestedQty)) {
      for (let i = 0; i < qty; i++) {
        reqCards.push({ card_type: name, card_id: "" });
      }
    }
    onSubmit(cardsOffered, reqCards, selectedTargetId);
  };

  // ── Picker filter ────────────────────────────────────────────────────────────
  const filteredCatalog = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return q
      ? allCatalogCards.filter((c) => c.cardName.toLowerCase().includes(q))
      : allCatalogCards;
  }, [allCatalogCards, requestSearch]);

  const allOfferGroups = useMemo(() => {
    const q = offerSearch.trim().toLowerCase();
    const combined = [
      ...handGroups.map((g) => ({ ...g, source: "hand" as const })),
      ...centerGroups.map((g) => ({ ...g, source: "center" as const })),
    ];
    return q
      ? combined.filter((g) => g.cardName.toLowerCase().includes(q))
      : combined;
  }, [handGroups, centerGroups, offerSearch]);

  // ── Positioning ──────────────────────────────────────────────────────────────
  const rect = anchorRef.current?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : 0;
  const aboveBottom =
    rect && typeof window !== "undefined"
      ? window.innerHeight - rect.top + 8
      : 0;
  const belowTop = rect ? rect.bottom + 8 : 0;

  // ── Shared card row renderer ─────────────────────────────────────────────────
  const renderRequestedCard = (cardName: string, qty: number) => {
    const display = cardLookup.get(cardName) ?? cardsRequested.find(c => c.cardName === cardName)!;
    return (
      <div key={cardName} className="relative flex flex-col items-center gap-1">
        <button
          onClick={() => removeRequested(cardName)}
          className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full
            bg-black/70 text-white text-[9px] leading-none flex items-center justify-center
            hover:bg-red-600 transition-colors"
        >
          ×
        </button>
        <CardComponent
          card={display}
          className="!w-14 !h-[82px]"
          noRaise
          noTransition
        />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => adjustRequested(cardName, -1)}
            disabled={qty <= 1 && totalRequested <= 1}
            className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
              hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
          <span className="w-6 text-center text-xs font-semibold text-white tabular-nums">
            {qty}
          </span>
          <button
            onClick={() => adjustRequested(cardName, 1)}
            className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
              hover:bg-black/80 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  const renderOfferedCard = (
    cardName: string,
    qty: number,
    source: "hand" | "center",
    max: number,
  ) => {
    const display = cardLookup.get(cardName)!;
    return (
      <div
        key={`${source}_${cardName}`}
        className="relative flex flex-col items-center gap-1"
      >
        <button
          onClick={() => removeOffered(cardName, source)}
          className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full
            bg-black/70 text-white text-[9px] leading-none flex items-center justify-center
            hover:bg-red-600 transition-colors"
        >
          ×
        </button>
        <CardComponent
          card={display}
          highlightColor={source === "center" ? "#fbbf24" : "#60a5fa"}
          className="!w-14 !h-[82px]"
          noRaise
          noTransition
        />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => adjustOffered(cardName, -1, source)}
            disabled={qty <= 0}
            className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
              hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
          <span className="w-10 text-center text-xs font-semibold text-white tabular-nums">
            {qty}/{max}
          </span>
          <button
            onClick={() => adjustOffered(cardName, 1, source)}
            disabled={qty >= max}
            className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
              hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Receiving section (above TradedCardsArea) ── */}
      <div
        style={{
          position: "fixed",
          bottom: aboveBottom,
          left: cx,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-2">
            {/* Add button */}
            <div className="relative self-center">
              <button
                onClick={() => {
                  setShowRequestPicker((p) => !p);
                  setShowOfferPicker(false);
                }}
                className="w-8 h-8 rounded-full bg-black/60 text-white text-lg font-bold
                  hover:bg-black/80 transition-colors flex items-center justify-center"
              >
                +
              </button>

              {showRequestPicker && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 rounded-xl
                    bg-[#1a120a]/95 border border-white/10 shadow-2xl
                    backdrop-blur-sm overflow-hidden z-40"
                >
                  <div className="p-2 border-b border-white/10">
                    <input
                      autoFocus
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search cards…"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5
                        placeholder:text-white/40 outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
                    {filteredCatalog.map((card) => (
                      <button
                        key={card.cardName}
                        onClick={() => {
                          setRequestedQty((prev) => ({
                            ...prev,
                            [card.cardName]: (prev[card.cardName] ?? 0) + 1,
                          }));
                          setShowRequestPicker(false);
                          setRequestSearch("");
                        }}
                        className="flex flex-col items-center gap-0.5 p-1 rounded-lg
                          hover:bg-white/10 transition-colors"
                      >
                        <CardComponent
                          card={card}
                          className="!w-12 !h-[70px]"
                          noRaise
                          noTransition
                        />
                        <span className="text-[9px] text-white/70 text-center leading-tight line-clamp-2">
                          {card.cardName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Requested cards */}
            {Object.entries(requestedQty).map(([name, qty]) =>
              renderRequestedCard(name, qty),
            )}
          </div>

          {/* Target selection */}
          {isTurnPlayer && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="inline-target"
                  checked={selectedTargetId === undefined}
                  onChange={() => setSelectedTargetId(undefined)}
                  className="accent-blue-400 w-3 h-3"
                />
                <span className="text-[11px] text-white/80">Everyone</span>
              </label>
              {players.map((p) => (
                <label
                  key={p.playerId}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="inline-target"
                    checked={selectedTargetId === p.playerId}
                    onChange={() => setSelectedTargetId(p.playerId)}
                    className="accent-blue-400 w-3 h-3"
                  />
                  <span className="text-[11px] text-white/80">
                    {p.playerName}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Giving section (below TradedCardsArea) ── */}
      <div
        style={{
          position: "fixed",
          top: belowTop,
          left: cx,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-2">
            {/* Add button */}
            <div className="relative self-center">
              <button
                onClick={() => {
                  setShowOfferPicker((p) => !p);
                  setShowRequestPicker(false);
                }}
                className="w-8 h-8 rounded-full bg-black/60 text-white text-lg font-bold
                  hover:bg-black/80 transition-colors flex items-center justify-center"
              >
                +
              </button>

              {showOfferPicker && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 rounded-xl
                    bg-[#1a120a]/95 border border-white/10 shadow-2xl
                    backdrop-blur-sm overflow-hidden z-40"
                >
                  <div className="p-2 border-b border-white/10">
                    <input
                      autoFocus
                      value={offerSearch}
                      onChange={(e) => setOfferSearch(e.target.value)}
                      placeholder="Search cards…"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5
                        placeholder:text-white/40 outline-none"
                    />
                  </div>
                  {allOfferGroups.length === 0 ? (
                    <p className="text-xs text-white/40 italic p-3 text-center">
                      No cards available.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
                      {allOfferGroups.map((group) => {
                        const currentQty =
                          group.source === "hand"
                            ? (offeredHandQty[group.cardName] ?? 0)
                            : (offeredCenterQty[group.cardName] ?? 0);
                        const max = group.available.length;
                        const atMax = currentQty >= max;
                        return (
                          <button
                            key={`${group.source}_${group.cardName}`}
                            onClick={() => {
                              if (!atMax) {
                                adjustOffered(group.cardName, 1, group.source);
                                setShowOfferPicker(false);
                                setOfferSearch("");
                              }
                            }}
                            disabled={atMax}
                            className="flex flex-col items-center gap-0.5 p-1 rounded-lg
                              hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <CardComponent
                              card={group.display}
                              highlightColor={
                                group.source === "center"
                                  ? "#fbbf24"
                                  : "#60a5fa"
                              }
                              className="!w-12 !h-[70px]"
                              noRaise
                              noTransition
                            />
                            <span className="text-[9px] text-white/70 text-center leading-tight line-clamp-2">
                              {group.cardName}
                            </span>
                            <span className="text-[9px] text-white/40">
                              {currentQty}/{max}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Offered hand cards */}
            {handGroups
              .filter((g) => (offeredHandQty[g.cardName] ?? 0) > 0)
              .map((g) =>
                renderOfferedCard(
                  g.cardName,
                  offeredHandQty[g.cardName] ?? 0,
                  "hand",
                  g.available.length,
                ),
              )}

            {/* Offered center cards */}
            {centerGroups
              .filter((g) => (offeredCenterQty[g.cardName] ?? 0) > 0)
              .map((g) =>
                renderOfferedCard(
                  g.cardName,
                  offeredCenterQty[g.cardName] ?? 0,
                  "center",
                  g.available.length,
                ),
              )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={totalRequested === 0}
              className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600
                text-white text-xs font-semibold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send offer ({totalRequested})
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80
                text-white/70 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
