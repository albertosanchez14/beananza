import { useState, useRef } from "react";
import Card from "@/components/card";
import Field from "@/components/field";
import Player from "@/components/player";
import { CenterCards, CardPile } from "@/components/card-pile";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";

type BoardProp = {
  myHand: CardType[];
  myPickedCards: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
  deckSize: number;
  discardPileSize: number;
  discardTopCard: CardType | null;
  currentTurnPlayerId?: string;
  gamePhase?: string;
  /** Number of cards turned face-up per turn, received from /config. */
  cardsPerTurn?: number;
  /** Lookup map from card name → CardType, built from /config by useGameConfig. */
  cardLookup: Map<string, CardType>;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
};

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
  cardLookup: cardLookupFromConfig,
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

  // Ref forwarded to DrawDeck so CenterCards can measure deal animation offset.
  const deckRef = useRef<HTMLDivElement>(null);

  const triggerPlantAnim = (slotId: string) => {
    if (plantAnimTimeout.current) clearTimeout(plantAnimTimeout.current);
    setPlantedSlotId(slotId);
    plantAnimTimeout.current = setTimeout(() => setPlantedSlotId(null), 350);
  };

  // Opponents fanned across the far arc of the table.
  const getPlayerPosition = (index: number, total: number) => {
    const centerDeg = 90;
    const maxSpread = 160;
    const spread = total <= 1 ? 0 : Math.min(maxSpread, (total - 1) * 50);
    const step = total > 1 ? spread / (total - 1) : 0;
    const angle =
      total === 1 ? centerDeg : centerDeg + spread / 2 - step * index;
    const angleRad = (angle * Math.PI) / 180;

    const rx = 36;
    const ry = 26;
    const cx = 50;
    const cy = 50;

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
  // Start from the config-sourced catalog so every card type always has images,
  // then overlay live cards (which carry real cardIds and up-to-date data).
  const cardLookup = new Map<string, CardType>(cardLookupFromConfig);
  for (const c of [...myHand, ...myPickedCards, ...centerCards]) {
    cardLookup.set(c.cardName, c);
  }
  if (discardTopCard) cardLookup.set(discardTopCard.cardName, discardTopCard);

  // A representative card for the draw deck back image.
  const backCard: CardType = myHand[0] ??
    myPickedCards[0] ??
    centerCards[0] ??
    discardTopCard ?? { cardId: "__deck__", cardName: "" };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#1a1008" }}
    >
      {/* ── TABLE ─────────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px" }}
      >
        <div
          className="absolute"
          style={{
            width: "82%",
            height: "72%",
            borderRadius: "50%",
            background: "#1e5c35",
            border: "14px solid #5c3311",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.85), inset 0 2px 12px rgba(255,255,255,0.06)",
            transform: "rotateX(28deg)",
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* ── OPPONENTS ─────────────────────────────────────────────────────── */}
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

      {/* ── CENTER: deck + face-up cards + discard ────────────────────────── */}
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
        <div
          className="flex items-end gap-6"
          style={{
            transform: "rotateX(25deg) scaleX(1.08)",
            transformOrigin: "bottom center",
          }}
        >
          <CardPile
            label="Center"
            count={deckSize}
            topCard={backCard}
            onClickAction={handleCenterDeckClick}
            deckRef={deckRef}
          />

          <CenterCards
            cards={centerCards}
            slots={cardsPerTurn}
            selectedCard={selectedCard}
            deckRef={deckRef}
            onCardClickAction={(card) => handleCardClick(card, "center")}
          />

          <CardPile
            label="Discard"
            count={discardPileSize}
            topCard={discardTopCard}
          />
        </div>
      </div>

      {/* ── CURRENT PLAYER ZONE ───────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 px-6 pb-5 pt-3"
        style={{ zIndex: 20 }}
      >
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
                            style={{ position: "relative", zIndex: layers + 1 }}
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
