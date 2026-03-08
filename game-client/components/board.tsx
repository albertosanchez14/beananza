import { useState, useRef, useEffect } from "react";
import Card from "@/components/card";
import Field from "@/components/field";
import Player from "@/components/player";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";
import { FULL_CARD_LOOKUP } from "@/schemas/cardCatalog";

type BoardProp = {
  myHand: CardType[];
  myPickedCards: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
  deckSize: number;
  discardPileSize: number;
  discardTopCard?: CardType | null;
  currentTurnPlayerId?: string;
  gamePhase?: string;
  /** Number of cards turned face-up per turn, received from the server. */
  cardsPerTurn?: number;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
};

const MAX_CARDS = 60;

function pileHeight(count: number): number {
  const min = 44;
  const max = 144;
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
  const CARD_W = 96;
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
    marginLeft: index === 0 ? 0 : -22,
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
  discardTopCard,
  currentTurnPlayerId,
  gamePhase,
  cardsPerTurn,
  onPlantBean,
  onHarvestField,
  onTurnOverBean,
  onDrawCards,
}: BoardProp) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [draggingPickedCardId, setDraggingPickedCardId] = useState<
    string | null
  >(null);
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
      dealTimeoutRef.current = setTimeout(
        () => setDealingCardIds(new Set()),
        520,
      );
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

  const handleFieldDrop = (
    slotId: string,
    slotIndex: number,
    card: CardType,
  ) => {
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

  // Build a name→CardType lookup.
  // Start from the static catalog so every card type always has images,
  // then overlay live cards (which carry real cardIds and up-to-date data).
  const cardLookup = new Map<string, CardType>(FULL_CARD_LOOKUP);
  for (const c of [...myHand, ...myPickedCards, ...centerCards]) {
    cardLookup.set(c.cardName, c);
  }
  if (discardTopCard) cardLookup.set(discardTopCard.cardName, discardTopCard);

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
              cardLookup={cardLookup}
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
        {/* Tilted content row */}
        <div
          className="flex items-end gap-6"
          style={{
            transform: "rotateX(25deg) scaleX(1.08)",
            transformOrigin: "bottom center",
          }}
        >
          {/* Draw deck — shows back face, depth layers give pile thickness */}
          {(() => {
            const layers = stackLayers(deckSize);
            const faceH = pileHeight(deckSize);
            const CARD_W = 96;
            const LAYER_H = 4;
            // A representative card just for the back image (any card in hand will do;
            // fall back to a bare object so backImage is still sourced from state).
            const backCard: CardType = myHand[0] ??
              myPickedCards[0] ??
              centerCards[0] ??
              discardTopCard ?? { cardId: "__deck__", cardName: "" };
            return (
              <div
                className="relative select-none"
                style={{ paddingBottom: layers * LAYER_H, width: CARD_W }}
              >
                {/* Depth layers — colour matches the back image (light blue-grey) */}
                {Array.from({ length: layers }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-2xl border-2"
                    style={{
                      width: CARD_W,
                      height: faceH,
                      top: (i + 1) * LAYER_H,
                      left: 0,
                      zIndex: layers - i,
                      background: "#4a6478",
                      borderColor: "#344d5c",
                    }}
                  />
                ))}
                {/* Top card — back face */}
                <div
                  style={{ position: "relative", zIndex: layers + 1 }}
                  className={deckSize === 0 ? "opacity-40" : ""}
                >
                  <Card
                    card={backCard}
                    flipped={true}
                    onClick={handleCenterDeckClick}
                    cardRef={(el) => {
                      (
                        deckRef as React.MutableRefObject<HTMLDivElement | null>
                      ).current = el;
                    }}
                  />
                </div>
                {/* Card count badge */}
                <div
                  className="absolute flex items-center justify-center w-6 h-6
                             bg-black/60 text-white text-xs font-bold rounded-full
                             border-2 border-white/60 shadow-md pointer-events-none"
                  style={{ top: 6, left: 6, zIndex: layers + 2 }}
                >
                  {deckSize}
                </div>
              </div>
            );
          })()}

          {/* Face-up center cards — fixed-width area reserving cardsPerTurn slots.
              Hidden until cardsPerTurn is known (first myState from server). */}
          {cardsPerTurn !== undefined && (
            <div
              className="flex items-end gap-2"
              style={{ width: cardsPerTurn * 96 + (cardsPerTurn - 1) * 8 }}
            >
              {Array.from({ length: cardsPerTurn }).map((_, i) => {
                const card = centerCards[i];
                if (!card) {
                  // Empty placeholder — keeps the slot reserved so nothing shifts
                  return (
                    <div
                      key={i}
                      style={{ width: 96, height: 144, flexShrink: 0 }}
                    />
                  );
                }
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
          {discardTopCard ? (
            <div className="relative select-none" style={{ width: 96 }}>
              {/* Depth layers — colour matches the back image (light blue-grey) */}
              {Array.from({ length: stackLayers(discardPileSize) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-2xl"
                    style={{
                      width: 96,
                      height: pileHeight(discardPileSize),
                      top: (i + 1) * 4,
                      left: 0,
                      zIndex: stackLayers(discardPileSize) - i,
                      background: "#4a6478",
                      border: "2px solid #344d5c",
                    }}
                  />
                ),
              )}
              {/* Top card — back face */}
              <div
                style={{
                  position: "relative",
                  zIndex: stackLayers(discardPileSize) + 1,
                }}
              >
                <Card card={discardTopCard} flipped={true} />
              </div>
              {/* Count badge */}
              {discardPileSize > 1 && (
                <div
                  className="absolute flex items-center justify-center w-5 h-5
                             bg-gray-600 text-white text-xs font-bold rounded-full
                             border-2 border-white shadow-md"
                  style={{
                    top: 4,
                    right: 4,
                    zIndex: stackLayers(discardPileSize) + 2,
                  }}
                >
                  {discardPileSize}
                </div>
              )}
            </div>
          ) : (
            <div className="w-24 h-36 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800/40 flex items-center justify-center">
              <span className="text-xs text-gray-500 font-medium tracking-wide">
                Discard
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── CURRENT PLAYER ZONE ─────────────────────────────── */}
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

        {/* My field + traded card stacks side by side */}
        {(() => {
          // Group picked cards by type, preserving insertion order.
          const pickedGroups: { cardName: string; cards: CardType[] }[] = [];
          const groupIndex = new Map<string, number>();
          for (const card of myPickedCards) {
            const idx = groupIndex.get(card.cardName);
            if (idx === undefined) {
              groupIndex.set(card.cardName, pickedGroups.length);
              pickedGroups.push({ cardName: card.cardName, cards: [card] });
            } else {
              pickedGroups[idx].cards.push(card);
            }
          }

          // Slab constants — identical to CardPile.
          const CARD_W = 96;
          const CARD_H = 144;
          const LAYER_H = 4;

          return (
            <div style={{ perspective: "700px" }}>
              <div
                className="flex items-center gap-3"
                style={{
                  transform: "rotateX(25deg) scaleX(1.08)",
                  transformOrigin: "bottom center",
                }}
              >
                {/* Planted field */}
                <Field
                  field={myField}
                  onSlotClick={handleFieldSlotClick}
                  onDrop={handleFieldDrop}
                  highlightEmpty={!!selectedCard}
                  plantedSlotId={plantedSlotId}
                  standalone={false}
                  cardLookup={cardLookup}
                />

                {/* Traded card stacks — one per unique card type */}
                {pickedGroups.length > 0 && (
                  <div
                    className="flex items-center gap-2 pl-2"
                    style={{ height: CARD_H }}
                  >
                    {pickedGroups.map(({ cardName, cards }) => {
                      const count = cards.length;
                      const topCard = cards[0];
                      const layers = Math.min(count - 1, 6);

                      return (
                        // Outer container: CARD_W wide × CARD_H tall, upright card
                        <div
                          key={cardName}
                          className="relative cursor-pointer select-none"
                          style={{ width: CARD_W, height: CARD_H }}
                          onClick={() => handleCardClick(topCard, "picked")}
                          title={cardName}
                        >
                          {/* Depth slabs */}
                          {Array.from({ length: layers }).map((_, i) => (
                            <div
                              key={i}
                              className="absolute rounded-2xl border-2 bg-amber-300 border-amber-500"
                              style={{
                                width: CARD_W,
                                height: CARD_H,
                                top: (i + 1) * LAYER_H,
                                left: 0,
                                zIndex: layers - i,
                              }}
                            />
                          ))}

                          {/* Top face — real Card */}
                          <div
                            style={{
                              position: "relative",
                              zIndex: layers + 1,
                            }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "application/card",
                                JSON.stringify(topCard),
                              );
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingPickedCardId(topCard.cardId);
                            }}
                            onDragEnd={() => setDraggingPickedCardId(null)}
                            className={
                              draggingPickedCardId === topCard.cardId
                                ? "opacity-40"
                                : ""
                            }
                          >
                            <Card
                              card={topCard}
                              flipped={false}
                              isSelected={
                                selectedCard != null &&
                                cards.some(
                                  (c) => c.cardId === selectedCard.cardId,
                                )
                              }
                            />
                          </div>

                          {/* Count badge */}
                          {count > 1 && (
                            <div
                              className="absolute flex items-center justify-center w-6 h-6
                                         bg-amber-600 text-white text-xs font-bold rounded-full
                                         border-2 border-white shadow-md pointer-events-none"
                              style={{ top: 4, right: 4, zIndex: layers + 2 }}
                            >
                              {count}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
