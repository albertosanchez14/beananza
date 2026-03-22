import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CardType, ExternalPlayer, SlotType } from "@/schemas/types";
import { useGameContext } from "@/components/game-context";
import Table from "@/components/table";
import { CardPile, CenterCards } from "@/components/card-pile";
import Opponents, { getFieldRotation } from "@/components/opponents";
import Center from "@/components/center";
import CurrentPlayer from "@/components/current-player";
import Slot from "@/components/slot";
import Field from "@/components/field";
import TradedCards from "./traded-cards";
import FanLayout from "@/components/fan-layout";
import Card from "@/components/card";
import Player from "@/components/player";
import { FlyingCard } from "@/components/flying-card";
import { PlantFlyingCard } from "@/components/plant-flying-card";
import { TurnOverFlyingCard } from "@/components/turn-over-flying-card";

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
};

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
};

export default function Board() {
  const {
    gameState,
    selectedCard,
    giveSelection,
    requestSelection,
    clearGiveSelection,
    toggleRequestSelection,
    clearRequestSelection,
    cardsPerTurn,
    cardLookup,
    myPlayerId,
    handleCardClick,
    handleDrawDeckClick,
    handleFieldSlotClick,
    handleFieldDrop,
    handleDragOver,
    handleDragLeave,
    dragOverSlot,
    highlightEmpty,
    onGiveDrop,
    onRequestDrop,
    onCardRightClick,
  } = useGameContext();

  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null);
  const [dragOverTraded, setDragOverTraded] = useState(false);

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
  } = gameState;

  const isTurnPlayer = myPlayerId === playerTurn;
  const isNonTurnTrade = phase === "turnTrade" && !isTurnPlayer;
  const deckRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentHandContainerRefs = useRef<Map<string, HTMLDivElement>>(
    new Map(),
  );
  const prevHandRef = useRef<CardType[]>(hand);
  const prevPlayersRef = useRef(players);
  const prevCenterCardsRef = useRef<CardType[]>(centerCards);
  const prevCenterCardRectsRef = useRef<
    Map<string, { left: number; top: number }>
  >(new Map());
  // Separate ref for turnOver detection — avoids interfering with opponent animation effect.
  const prevCenterCardsForTurnRef = useRef<CardType[]>(centerCards);

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
      const startX = deckRect.left + (deckRect.width - 96) / 2;
      const startY = deckRect.bottom - 144;

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
              ? cardRect.left + (cardRect.width - 96) / 2
              : startX,
            targetY: cardRect ? cardRect.bottom - 144 : startY,
            index: i,
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
        newFlying.forEach((e) => next.add(e.opponentSlotId!));
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
      <Table>
        <Opponents>
          {players.map((player) => {
            const isTurnPlayer = myPlayerId === playerTurn;
            const isEligibleTarget =
              phase === "turnTrade" &&
              (isTurnPlayer || player.playerId === playerTurn);

            const handlePlayerDragOver = isEligibleTarget
              ? (e: React.DragEvent) => {
                  if (
                    !isTurnPlayer &&
                    e.dataTransfer.types.includes("application/center-card")
                  )
                    return;
                  e.preventDefault();
                  setDragOverPlayerId(player.playerId);
                }
              : undefined;

            const handlePlayerDragLeave = isEligibleTarget
              ? () => setDragOverPlayerId(null)
              : undefined;

            const handlePlayerDrop = isEligibleTarget
              ? (e: React.DragEvent) => {
                  e.preventDefault();
                  setDragOverPlayerId(null);
                  const raw = e.dataTransfer.getData("application/card");
                  if (!raw) return;
                  try {
                    const dragged = JSON.parse(raw) as CardType;
                    const seen = new Set<string>();
                    const cardsToGive: CardType[] = [];
                    for (const c of [...giveSelection, dragged]) {
                      if (!seen.has(c.cardId)) {
                        seen.add(c.cardId);
                        const isCenterCard = centerCards.some(
                          (cc) => cc.cardId === c.cardId,
                        );
                        if (!isTurnPlayer && isCenterCard) continue;
                        cardsToGive.push(c);
                      }
                    }
                    clearGiveSelection();
                    if (cardsToGive.length > 0)
                      onGiveDrop(player as ExternalPlayer, cardsToGive);
                  } catch {
                    // ignore malformed payload
                  }
                }
              : undefined;

            return (
              <Player
                key={player.playerId}
                playerId={player.playerId}
                playerName={player.playerName}
                playerStatus="active"
                playerCoins={player.playerCoins}
                playerPickedCardsCount={player.playerPickedCardsCount}
                isCurrentTurn={player.playerId === playerTurn}
                gamePhase={phase}
                isDragTarget={dragOverPlayerId === player.playerId}
                onDragOver={handlePlayerDragOver}
                onDragLeave={handlePlayerDragLeave}
                onDrop={handlePlayerDrop}
                field={
                  <Field>
                    {player.playerField.slots.map((slot, index) => {
                      const cardForSlot = slot.cardName
                        ? (cardLookup?.get(slot.cardName) ?? null)
                        : null;
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
                                  phase === "turnTrade"
                                    ? () =>
                                        onCardRightClick(
                                          cardForSlot,
                                          player.playerId,
                                        )
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
                        <Card key={index} card={{ backImage }} flipped={true} />
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
          <CenterCards slots={cardsPerTurn ?? 3}>
            {centerCards.map((card) => (
              <div
                key={card.cardId}
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/center-card", "true")
                }
              >
                <Card
                  card={card}
                  ref={(el) => {
                    if (el) cardRefs.current.set(card.cardId, el);
                    else cardRefs.current.delete(card.cardId);
                  }}
                  hidden={hiddenCenterCardIds.has(card.cardId)}
                  isSelected={
                    phase === "turnTrade"
                      ? isTurnPlayer
                        ? selectedCard?.cardId === card.cardId
                        : requestSelection.some((c) => c.cardId === card.cardId)
                      : selectedCard?.cardId === card.cardId
                  }
                  draggable={phase !== "plantTrade"}
                  onClick={
                    isNonTurnTrade
                      ? () => toggleRequestSelection(card)
                      : () => handleCardClick(card, "center")
                  }
                  onContextMenu={
                    phase === "turnTrade" && !isTurnPlayer
                      ? () => onCardRightClick(card, playerTurn)
                      : undefined
                  }
                />
              </div>
            ))}
          </CenterCards>
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
              return (
                <div key={s.slotId}>
                  <Slot
                    slot={s}
                    index={index}
                    dragOverSlot={dragOverSlot}
                    highlightEmpty={highlightEmpty}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleFieldDrop={handleFieldDrop}
                    handleSlotClick={handleFieldSlotClick}
                  >
                    {cardForSlot && (
                      <Card
                        card={cardForSlot}
                        flipped={false}
                        onContextMenu={
                          phase === "turnTrade"
                            ? () =>
                                onCardRightClick(
                                  cardForSlot,
                                  isTurnPlayer ? undefined : playerTurn,
                                )
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
          <div
            onDragOver={
              isNonTurnTrade
                ? (e) => {
                    e.preventDefault();
                    setDragOverTraded(true);
                  }
                : undefined
            }
            onDragLeave={
              isNonTurnTrade ? () => setDragOverTraded(false) : undefined
            }
            onDrop={
              isNonTurnTrade
                ? (e: React.DragEvent) => {
                    e.preventDefault();
                    setDragOverTraded(false);
                    const raw = e.dataTransfer.getData("application/card");
                    if (!raw) return;
                    try {
                      const dragged = JSON.parse(raw) as CardType;
                      const seen = new Set<string>();
                      const cardsToRequest: CardType[] = [];
                      for (const c of [...requestSelection, dragged]) {
                        if (!seen.has(c.cardId)) {
                          seen.add(c.cardId);
                          cardsToRequest.push(c);
                        }
                      }
                      clearRequestSelection();
                      onRequestDrop(cardsToRequest);
                    } catch {
                      // ignore malformed payload
                    }
                  }
                : undefined
            }
            className={[
              "rounded-xl transition-colors",
              isNonTurnTrade
                ? "min-w-[60px] min-h-[144px] flex items-center"
                : "",
              dragOverTraded
                ? "bg-blue-500/20 ring-2 ring-blue-400 ring-inset"
                : "",
            ].join(" ")}
          >
            <TradedCards />
            {isNonTurnTrade && !dragOverTraded && (
              <span className="text-xs text-blue-300/60 px-2 select-none pointer-events-none">
                Drop to request
              </span>
            )}
          </div>
        }
        hand={
          // position:relative so flying cards (position:absolute) are
          // anchored here and share the same stacking context as the fan.
          <div ref={handRef} style={{ position: "relative" }}>
            {/* Flying cards — z-index:1 so they slide behind existing fan cards */}
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
                const isSelected =
                  phase === "turnTrade"
                    ? giveSelection.some((c) => c.cardId === card.cardId)
                    : selectedCard?.cardId === card.cardId;
                return (
                  <Card
                    key={card.cardId}
                    card={card}
                    ref={(el) => {
                      if (el) cardRefs.current.set(card.cardId, el);
                      else cardRefs.current.delete(card.cardId);
                    }}
                    isSelected={isSelected}
                    draggable={phase !== "plantTrade"}
                    hidden={hiddenCardIds.has(card.cardId)}
                    onClick={() => handleCardClick(card, "hand")}
                    onContextMenu={
                      phase === "turnTrade"
                        ? () =>
                            onCardRightClick(
                              card,
                              isTurnPlayer ? undefined : playerTurn,
                            )
                        : undefined
                    }
                  />
                );
              })}
            </FanLayout>
          </div>
        }
      />
    </div>
  );
}
