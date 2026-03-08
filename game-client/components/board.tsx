import { useState, useRef, useEffect } from "react";
import Card from "@/components/card";
import Field from "@/components/field";
import Player from "@/components/player";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";

type BoardProp = {
  myHand: CardType[];
  myPickedCards: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
  deckSize: number;
  discardPileSize: number;
  currentTurnPlayerId?: string;
  gamePhase?: string;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
};

const MAX_CARDS = 60;

function pileHeight(count: number): number {
  const min = 36;
  const max = 112;
  return Math.round(
    min + (Math.min(count, MAX_CARDS) / MAX_CARDS) * (max - min),
  );
}

function stackLayers(count: number): number {
  if (count === 0) return 0;
  return Math.min(7, Math.ceil((count / MAX_CARDS) * 7) + 1);
}

type PileProps = {
  count: number;
  label: string;
  faceClass: string;
  shadowClass: string;
  onClick?: () => void;
  actionable?: boolean;
  pileRef?: React.RefObject<HTMLDivElement | null>;
};

function CardPile({
  count,
  label,
  faceClass,
  shadowClass,
  onClick,
  actionable = false,
  pileRef,
}: PileProps) {
  const layers = stackLayers(count);
  const faceH = pileHeight(count);
  const CARD_W = 80;
  const LAYER_H = 4;

  return (
    <div
      className="relative select-none"
      style={{ paddingBottom: layers * LAYER_H, width: CARD_W }}
    >
      {/* Top face — highest z-index, sits on top of the stack */}
      <div
        ref={pileRef}
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center
                    rounded-lg border-2 shadow-lg
                    transition-all duration-200
                    ${faceClass}
                    ${actionable && count > 0 ? "cursor-pointer hover:brightness-110" : ""}
                    ${count === 0 ? "opacity-40" : ""}`}
        style={{ width: CARD_W, height: faceH, zIndex: layers + 1 }}
      >
        <span className="text-xs font-semibold text-center leading-tight px-1">
          {label}
        </span>
        <span className="text-lg font-bold mt-1">{count}</span>
      </div>
      {/* Depth layers stacked downward — in rotateX(25deg) space "down" is
          toward the viewer, so these appear as the front thickness of the pile */}
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          className={`absolute rounded-lg border ${shadowClass}`}
          style={{
            width: CARD_W,
            height: faceH,
            top: (i + 1) * LAYER_H,
            left: 0,
            zIndex: layers - i,
          }}
        />
      ))}
    </div>
  );
}

function getFanStyle(
  index: number,
  total: number,
  isSelected: boolean,
): React.CSSProperties {
  if (total === 0) return {};
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotateDeg = offset * 4;
  const arcDrop = Math.abs(offset) ** 1.5 * 4;
  const translateY = isSelected ? -28 : arcDrop;
  const rotate = isSelected ? 0 : rotateDeg;

  return {
    transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
    transformOrigin: "bottom center",
    zIndex: isSelected ? 100 : total - index,
    marginLeft: index === 0 ? 0 : -18,
    position: "relative",
    transition: "transform 0.15s ease, z-index 0s",
  };
}

export default function Board({
  myHand,
  myPickedCards,
  myField,
  players,
  centerCards,
  deckSize,
  discardPileSize,
  currentTurnPlayerId,
  gamePhase,
  onPlantBean,
  onHarvestField,
  onTurnOverBean,
  onDrawCards,
}: BoardProp) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [plantedSlotId, setPlantedSlotId] = useState<string | null>(null);
  const plantAnimTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deal-from-deck animation tracking
  const [dealingCardIds, setDealingCardIds] = useState<Set<string>>(new Set());
  const prevCenterCountRef = useRef<number>(centerCards.length);
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevCenterCountRef.current;
    const curr = centerCards.length;
    prevCenterCountRef.current = curr;

    if (curr <= prev) return; // cards removed or same — no deal anim needed

    // New cards are appended at the end
    const newCards = centerCards.slice(prev);
    const newIds = new Set(newCards.map((c) => c.cardId));

    // Measure deck→card offset for each new card so the CSS var is accurate.
    // We do this in a rAF so the DOM has rendered the new cards.
    requestAnimationFrame(() => {
      const deckEl = deckRef.current;
      if (!deckEl) return;
      const deckRect = deckEl.getBoundingClientRect();
      const deckCx = deckRect.left + deckRect.width / 2;
      const deckCy = deckRect.top + deckRect.height / 2;

      newIds.forEach((id) => {
        const cardEl = cardRefs.current.get(id);
        if (!cardEl) return;
        const cardRect = cardEl.getBoundingClientRect();
        const cardCx = cardRect.left + cardRect.width / 2;
        const cardCy = cardRect.top + cardRect.height / 2;
        // offset = where card needs to START (deck pos) relative to its resting place
        const dx = deckCx - cardCx;
        const dy = deckCy - cardCy;
        cardEl.style.setProperty("--deck-dx", `${dx}px`);
        cardEl.style.setProperty("--deck-dy", `${dy}px`);
      });

      setDealingCardIds(new Set(newIds));

      if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
      dealTimeoutRef.current = setTimeout(() => setDealingCardIds(new Set()), 520);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerCards]);

  const triggerPlantAnim = (slotId: string) => {
    if (plantAnimTimeout.current) clearTimeout(plantAnimTimeout.current);
    setPlantedSlotId(slotId);
    plantAnimTimeout.current = setTimeout(() => setPlantedSlotId(null), 350);
  };

  // Opponents fanned across the far arc of the table.
  // The table oval is centred at (50%, 50%) of the scene, so we fan players
  // along the upper half of an ellipse with rx≈38%, ry≈28% of the scene.
  const getPlayerPosition = (index: number, total: number) => {
    const centerDeg = 90; // straight up
    const maxSpread = 160; // never wrap more than 160° across the top arc
    const spread = total <= 1 ? 0 : Math.min(maxSpread, (total - 1) * 50);
    const step = total > 1 ? spread / (total - 1) : 0;
    const angle =
      total === 1 ? centerDeg : centerDeg + spread / 2 - step * index;
    const angleRad = (angle * Math.PI) / 180;

    // Ellipse radii relative to the scene container
    const rx = 36; // % of width
    const ry = 26; // % of height
    const cx = 50; // % centre-x
    const cy = 50; // % centre-y (table oval centre)

    const x = cx + rx * Math.cos(angleRad);
    const y = cy - ry * Math.sin(angleRad);

    return { left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" };
  };

  const handleCardClick = (
    card: CardType,
    source: "hand" | "picked" | "center" = "hand",
  ) => {
    if (gamePhase === "plantTrade" && source === "hand") return;
    if (selectedCard?.cardId === card.cardId) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleFieldSlotClick = (slotId: string, slotIndex: number) => {
    const slot = myField.slots[slotIndex];
    if (selectedCard) {
      if (!slot || !slot.cardName || slot.cardName === selectedCard.cardName) {
        triggerPlantAnim(slotId);
        onPlantBean(selectedCard.cardId, slotId);
        setSelectedCard(null);
      }
    } else {
      if (slot && slot.cardName && slot.cardQuantity > 0) {
        onHarvestField(slot.slotId);
      }
    }
  };

  const handleFieldDrop = (slotId: string, slotIndex: number, card: CardType) => {
    const slot = myField.slots[slotIndex];
    if (!slot || !slot.cardName || slot.cardName === card.cardName) {
      onPlantBean(card.cardId, slotId);
      setSelectedCard(null);
    }
  };

  const handleCenterDeckClick = () => {
    if (gamePhase === "plantHand") {
      onTurnOverBean();
    } else {
      onDrawCards();
    }
  };

  return (
    // Dark room floor — fills all available space, never scrolls
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#1a1008" }}
    >
      {/* ── TABLE ───────────────────────────────────────────────────────────
          A rectangle rendered inside a perspective context and tilted with
          rotateX so it looks like an oval table viewed from a seated position.
          It is centred in the scene and its bottom half disappears behind the
          player zone at the bottom of the screen.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px" }}
      >
        <div
          className="absolute"
          style={{
            // Table surface: wide rectangle that becomes an oval in perspective
            width: "82%",
            height: "72%",
            borderRadius: "50%",
            background: "#1e5c35",
            border: "14px solid #5c3311",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.85), inset 0 2px 12px rgba(255,255,255,0.06)",
            // Tilt it away from the viewer — the near edge goes down, far goes up
            transform: "rotateX(28deg)",
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* ── OPPONENTS ───────────────────────────────────────────────────────
          Absolutely positioned along the upper arc of the table.
      ─────────────────────────────────────────────────────────────────────── */}
      {players.map((player, index) => {
        const position = getPlayerPosition(index, players.length);
        return (
          <div
            key={player.playerId}
            className="absolute"
            style={{ ...position, zIndex: 10 }}
          >
            <Player
              player={player}
              isClickable={!!selectedCard}
              isCurrentTurn={player.playerId === currentTurnPlayerId}
              gamePhase={gamePhase}
            />
          </div>
        );
      })}

      {/* ── CENTER: deck + discard + face-up cards ──────────────────────────
          Sits at the middle of the table, tilted with the same rotateX as the
          Field and player fields so everything lies flat on the surface.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          perspective: "700px",
        }}
      >
        {/* Labels row — flat, above the tilt */}
        <div className="flex items-end gap-6 mb-1">
          <span className="text-xs text-green-400 font-medium tracking-wide w-20 text-center">
            Deck
          </span>
          {centerCards.length > 0 && (
            <span className="text-xs text-blue-300 font-medium tracking-wide text-center"
              style={{ width: centerCards.length * 80 + (centerCards.length - 1) * 8 }}
            >
              Face up
            </span>
          )}
          <span className="text-xs text-gray-400 font-medium tracking-wide w-20 text-center">
            Discard
          </span>
        </div>

        {/* Tilted content row */}
        <div
          className="flex items-end gap-6"
          style={{
            transform: "rotateX(25deg) scaleX(1.08)",
            transformOrigin: "bottom center",
          }}
        >
          {/* Draw deck */}
          <CardPile
            count={deckSize}
            label="Draw"
            faceClass="bg-green-700 border-green-900 text-white"
            shadowClass="bg-green-800 border-green-900"
            onClick={handleCenterDeckClick}
            actionable
            pileRef={deckRef}
          />

          {/* Face-up center cards */}
          {centerCards.length > 0 && (
            <div className="flex items-end gap-2">
              {centerCards.map((card) => {
                const isDealing = dealingCardIds.has(card.cardId);
                return (
                  <Card
                    key={card.cardId}
                    card={card}
                    isSelected={selectedCard?.cardId === card.cardId}
                    draggable
                    onClick={() => handleCardClick(card, "center")}
                    cardRef={(el) => {
                      if (el) cardRefs.current.set(card.cardId, el);
                      else cardRefs.current.delete(card.cardId);
                    }}
                    className={isDealing ? "animate-deal" : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* Discard pile */}
          <CardPile
            count={discardPileSize}
            label="Discard"
            faceClass="bg-gray-700 border-gray-900 text-gray-200"
            shadowClass="bg-gray-800 border-gray-900"
          />
        </div>
      </div>

      {/* ── CURRENT PLAYER ZONE ─────────────────────────────────────────────
          Anchored to the bottom of the scene. No separate background — the
          table surface shows through. An inner shadow at the top creates depth
          at the near edge.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 px-6 pb-5 pt-3"
        style={{
          zIndex: 20,
        }}
      >
        {/* Selection indicator */}
        {selectedCard && (
          <div className="w-full max-w-lg px-4 py-1.5 bg-black/40 border border-green-600/40 rounded-lg text-center">
            <p className="text-sm font-semibold text-green-200">
              Selected:{" "}
              <span className="font-bold text-white">
                {selectedCard.cardName}
              </span>
            </p>
            <p className="text-xs text-green-400">
              {gamePhase === "plantTrade"
                ? "Click a field slot to plant"
                : "Click a field to plant or a player to trade"}
            </p>
          </div>
        )}

        {/* My field */}
        <Field
          field={myField}
          onSlotClick={handleFieldSlotClick}
          onDrop={handleFieldDrop}
          highlightEmpty={!!selectedCard}
          plantedSlotId={plantedSlotId}
        />

        {/* Traded / picked cards */}
        {myPickedCards.length > 0 && (
          <div className="w-full max-w-lg">
            <p className="text-xs font-semibold text-amber-400 mb-1 text-center">
              Traded cards
              {gamePhase === "plantTrade"
                ? " — must plant before advancing"
                : ""}
            </p>
            <div className="flex justify-center gap-4 rounded-xl px-4 py-3 border border-amber-500/50 bg-black/20">
              {myPickedCards.map((card, index) => (
                <Card
                  key={index}
                  card={card}
                  isSelected={selectedCard?.cardId === card.cardId}
                  draggable
                  onClick={() => handleCardClick(card, "picked")}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hand — fan arc */}
        <div
          className={`flex items-end justify-center pb-2
            ${gamePhase === "plantTrade" ? "opacity-40 pointer-events-none" : ""}`}
          style={{ minHeight: "8rem" }}
        >
          {myHand.map((card, index) => {
            const isSelected = selectedCard?.cardId === card.cardId;
            return (
              <Card
                key={index}
                card={card}
                isSelected={isSelected}
                draggable={gamePhase !== "plantTrade"}
                onClick={() => handleCardClick(card, "hand")}
                style={getFanStyle(index, myHand.length, isSelected)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
