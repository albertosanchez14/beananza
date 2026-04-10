"use client";

import { useEffect } from "react";
import type React from "react";
import { CardType, ExternalPlayer, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";

type Props = {
  isTurnPlayer: boolean;
  players: ExternalPlayer[];
  anchorRef: React.RefObject<HTMLDivElement | null>;
  // Offered state owned by Board
  offeredCards: CardType[];
  // Requested state owned by Board
  requestedQty: Record<string, number>;
  selectedTargetId: string | undefined;
  onTargetChange: (id: string | undefined) => void;
  showReqPicker: boolean;
  onToggleReqPicker: (open: boolean) => void;
  filteredCatalog: CardType[];
  reqSearch: string;
  onReqSearchChange: (q: string) => void;
  onAddReqCard: (cardName: string) => void;
  onSubmit: (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId: string | undefined,
  ) => void;
  onClose: () => void;
};

export default function InlineModal({
  isTurnPlayer,
  players,
  anchorRef,
  offeredCards,
  requestedQty,
  selectedTargetId,
  onTargetChange,
  showReqPicker,
  onToggleReqPicker,
  filteredCatalog,
  reqSearch,
  onReqSearchChange,
  onAddReqCard,
  onSubmit,
  onClose,
}: Props) {
  // ── Keyboard close ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const cardsOffered: OfferCard[] = offeredCards.map((c) => ({
      card_type: c.cardName,
      card_id: c.cardId,
    }));
    const reqCards: OfferCard[] = [];
    for (const [name, qty] of Object.entries(requestedQty)) {
      for (let i = 0; i < qty; i++) {
        reqCards.push({ card_type: name, card_id: "" });
      }
    }
    onSubmit(cardsOffered, reqCards, selectedTargetId);
  };

  // ── Positioning ──────────────────────────────────────────────────────────────
  const rect = anchorRef.current?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : 0;
  const aboveBottom =
    rect && typeof window !== "undefined"
      ? window.innerHeight - rect.top + 8
      : 0;
  const belowTop = rect ? rect.bottom + 8 : 0;

  return (
    <>
      {/* ── Requested card picker (above action bar) ── */}
      {showReqPicker && (
        <div
          style={{
            position: "fixed",
            bottom: aboveBottom + 48,
            left: cx,
            transform: "translateX(-50%)",
            zIndex: 40,
          }}
        >
          <div
            className="w-56 rounded-xl bg-[#1a120a]/95 border border-white/10 shadow-2xl
              backdrop-blur-sm overflow-hidden"
          >
            <div className="p-2 border-b border-white/10">
              <input
                autoFocus
                value={reqSearch}
                onChange={(e) => onReqSearchChange(e.target.value)}
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
                    onAddReqCard(card.cardName);
                    onToggleReqPicker(false);
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
        </div>
      )}

      {/* ── Compact action bar (above TradedCardsArea) ── */}
      <div
        style={{
          position: "fixed",
          bottom: aboveBottom,
          left: cx,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-1 rounded-lg bg-blue-500 hover:bg-blue-600
                text-white text-xs font-semibold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send offer
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-black/60 hover:bg-black/80
                text-white/70 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>

          {isTurnPlayer && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="inline-target"
                  checked={selectedTargetId === undefined}
                  onChange={() => onTargetChange(undefined)}
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
                    onChange={() => onTargetChange(p.playerId)}
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

      {/* ── Instructional hint (below TradedCardsArea) ── */}
      <div
        style={{
          position: "fixed",
          top: belowTop,
          left: cx,
          transform: "translateX(-50%)",
          zIndex: 30,
        }}
      >
        <p className="text-[11px] text-white/50 italic whitespace-nowrap">
          {isTurnPlayer
            ? "Click hand or table cards to give"
            : "Click hand cards to give"}
        </p>
      </div>
    </>
  );
}
