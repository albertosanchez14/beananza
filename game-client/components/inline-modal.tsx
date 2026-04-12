"use client";

import { useEffect } from "react";
import { CardType, ExternalPlayer, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";

type Props = {
  isTurnPlayer: boolean;
  players: ExternalPlayer[];
  getAnchorRect: () => DOMRect | undefined;
  // Offered state owned by Board
  offeredCards: CardType[];
  // Requested state owned by Board
  requestedQty: Record<string, number>;
  selectedTargetId: string | undefined;
  onTargetChange: (id: string | undefined) => void;
  showReqPicker: boolean;
  onToggleReqPicker: (open: boolean) => void;
  filteredCatalog: CardType[];
  onAddReqCard: (cardName: string) => void;
  hideTargetPicker?: boolean;
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
  getAnchorRect,
  offeredCards,
  requestedQty,
  selectedTargetId,
  onTargetChange,
  showReqPicker,
  onToggleReqPicker,
  filteredCatalog,
  onAddReqCard,
  hideTargetPicker = false,
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
  const rect = getAnchorRect();
  const cx = rect ? rect.left + rect.width / 2 : 0;
  const aboveBottom =
    rect && typeof window !== "undefined"
      ? window.innerHeight - rect.top + 8
      : 0;

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
            className="w-65 rounded-xl overflow-hidden"
            style={{
              backgroundImage: "url('/card-picker-bg.webp')",
              backgroundSize: "100% 100%",
              backgroundPosition: "top center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {/* Header — shows the top slice of the image */}
            <div className="px-3 pt-4 py-2 ">
              <p
                className="text-center font-serif italic text-xs tracking-wide"
                style={{ color: "#5c3a1e" }}
              >
                — Request a Card —
              </p>
            </div>

            {/* Scroll container — transparent, just clips */}
            <div className="px-6 pt-2 pb-3">
              {/* Grid div — background lives here so it grows with content */}
              <div className="grid grid-cols-3 gap-1.5">
                {filteredCatalog.map((card) => (
                  <button
                    key={card.cardName}
                    onClick={() => {
                      onAddReqCard(card.cardName);
                      onToggleReqPicker(false);
                    }}
                    className="flex flex-col items-center gap-0.5 p-1 rounded-lg
                      hover:bg-[#8b5e3c]/20 transition-colors"
                  >
                    <CardComponent
                      card={card}
                      className="w-12! h-17.5!"
                      noRaise
                      noTransition
                    />
                  </button>
                ))}
              </div>
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

          {isTurnPlayer && !hideTargetPicker && (
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
    </>
  );
}
