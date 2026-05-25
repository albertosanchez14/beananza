import { useEffect, useLayoutEffect, useState } from "react";
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
  // Captured once on mount and on resize — not on every render — so that
  // intermediate re-renders (e.g. draftState async sync) don't shift the modal.
  const [pos, setPos] = useState({ cx: 0, aboveBottom: 0 });
  useLayoutEffect(() => {
    const update = () => {
      const rect = getAnchorRect();
      if (!rect) return;
      setPos({
        cx: rect.left + rect.width / 2,
        aboveBottom: window.innerHeight - rect.top + 8,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { cx, aboveBottom } = pos;

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
            <div className="px-3 pt-6 pb-2 ">
              <p
                className="font-semibold text-center tracking-wide"
                style={{ color: "#5c3a1e" }}
              >
                — Request a Card —
              </p>
            </div>

            {/* Scroll container — transparent, just clips */}
            <div className="px-8 pt-2 pb-6">
              {/* Grid div — background lives here so it grows with content */}
              <div className="grid grid-cols-3 gap-1.5">
                {filteredCatalog.map((card) => (
                  <button
                    key={card.cardName}
                    onClick={() => {
                      onAddReqCard(card.cardName);
                      onToggleReqPicker(false);
                    }}
                    className="flex flex-col items-center"
                  >
                    <CardComponent
                      card={card}
                      scale={0.6}
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
              className="px-4 py-1 rounded text-xs font-semibold 
							transition-colors bg-green-700 hover:bg-green-600 active:bg-green-800 
							border border-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send offer
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded text-xs font-semibold 
							transition-colors bg-green-900 hover:bg-green-800 active:bg-green-950 border border-green-600/60 hover:border-green-400 text-white"
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
                  className="accent-green-600 w-3 h-3"
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
                    className="accent-green-600 w-3 h-3"
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
