import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CardType, SlotType } from "@/schemas/types";
import { useGameContext } from "@/components/game-context";

import Table from "@/components/table";
import { CardPile, CenterCards } from "@/components/card-pile";
import Opponents from "@/components/opponents";
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
    cardsPerTurn,
    cardLookup,
    handleCardClick,
    handleDrawDeckClick,
    handleFieldSlotClick,
    handleFieldDrop,
    handleDragOver,
    handleDragLeave,
    dragOverSlot,
    highlightEmpty,
    actionErrorSignal,
  } = useGameContext();

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

  const deckRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const opponentHandContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Maps slotId → { card, cardId, startX, startY } for actions awaiting server
  // confirmation. Animation starts only after the server accepts the action.
  const pendingAnimations = useRef<
    Map<string, { card: CardType; cardId: string; startX: number; startY: number }>
  >(new Map());
  const prevHandRef = useRef<CardType[]>(hand);
  const prevPlayersRef = useRef(players);
  const prevCenterCardsRef = useRef<CardType[]>(centerCards);
  const prevCenterCardRectsRef = useRef<Map<string, { left: number; top: number }>>(new Map());

  const [flyingCards, setFlyingCards] = useState<FlyingCardEntry[]>([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [plantFlyingCards, setPlantFlyingCards] = useState<
    PlantFlyingCardEntry[]
  >([]);
  const [suppressedSlotIds, setSuppressedSlotIds] = useState<Set<string>>(
    new Set(),
  );
  // Slots whose card should be hidden while the flying card is in transit.
  const [animatingSlotIds, setAnimatingSlotIds] = useState<Set<string>>(
    new Set(),
  );
  const [animatingOpponentSlotIds, setAnimatingOpponentSlotIds] = useState<Set<string>>(
    new Set(),
  );

  useLayoutEffect(() => {
    const prevIds = new Set(prevHandRef.current.map((c) => c.cardId));
    const newCards = hand.filter((c) => !prevIds.has(c.cardId));

    if (newCards.length > 0 && deckRef.current && handRef.current) {
      const deckRect = deckRef.current.getBoundingClientRect();
      const handRect = handRef.current.getBoundingClientRect();

      // All coordinates are relative to the hand wrapper so the flying card
      // lives in the same stacking context as the fan cards.
      const startX = deckRect.left + (deckRect.width - 96) / 2 - handRect.left;
      const startY = deckRect.top - handRect.top;

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

    players.forEach((player) => {
      const prevPlayer = prevPlayers.find((p) => p.playerId === player.playerId);
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
            startY = (deckRect?.top ?? 0) + ((deckRect?.height ?? 144) - 144) / 2;
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
            startY = (deckRect?.top ?? 0) + ((deckRect?.height ?? 144) - 144) / 2;
          }
          initialScale = 0.28;
        }

        const fromHand = initialScale === 0.28;
        // Only hide the slot while animating when the slot was previously empty.
        const slotWasEmpty = prevCount === 0;
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
          // Center plants: 2D spin to match the rotated slot orientation.
          // Hand plants: rotateX flip (bottom axis) scaling to match slot size;
          // no 2D spin since the flip itself provides the visual.
          ...(!fromHand
            ? { targetRotate: 180 }
            : { initialRotate: 180, targetRotateX: 25, targetScaleX: 1.08, targetScale: 0.75 }),
          initialScale,
          ...(slotWasEmpty ? { opponentSlotId: slot.slotId } : {}),
        });
      });
    });

    if (newFlying.length > 0) {
      setPlantFlyingCards((prev) => [...prev, ...newFlying]);
      const toHide = newFlying
        .filter((e) => e.opponentSlotId)
        .map((e) => e.opponentSlotId!);
      if (toHide.length > 0) {
        setAnimatingOpponentSlotIds((prev) => {
          const next = new Set(prev);
          toHide.forEach((id) => next.add(id));
          return next;
        });
      }
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

  // When the server confirms a slot is filled, start the flying card animation
  // for any pending plant action targeting that slot.
  useLayoutEffect(() => {
    const newFlying: PlantFlyingCardEntry[] = [];
    const startedSlotIds = new Set<string>();

    field.slots.forEach((s) => {
      const pending = pendingAnimations.current.get(s.slotId);
      if (pending && s.cardName) {
        const slotEl = slotRefs.current.get(s.slotId);
        if (!slotEl) {
          pendingAnimations.current.delete(s.slotId);
          return;
        }
        const slotRect = slotEl.getBoundingClientRect();
        newFlying.push({
          id: s.slotId,
          card: pending.card,
          startX: pending.startX,
          startY: pending.startY,
          targetX: slotRect.left + (slotRect.width - 96) / 2,
          targetY: slotRect.bottom - 144,
          targetRotateX: 25,
          targetScaleX: 1.08,
        });
        startedSlotIds.add(s.slotId);
        pendingAnimations.current.delete(s.slotId);
      }
    });

    if (newFlying.length > 0) {
      setPlantFlyingCards((prev) => [...prev, ...newFlying]);
      setAnimatingSlotIds((prev) => {
        const next = new Set(prev);
        startedSlotIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [field]);

  // Roll back pending plant actions when the server returns an error.
  // Because the animation only starts after server confirmation, no flying
  // card has been spawned yet — we just restore hidden/suppressed state.
  useLayoutEffect(() => {
    if (actionErrorSignal === 0) return;
    if (pendingAnimations.current.size === 0) return;
    // Restore visibility of cards hidden while waiting for server.
    setHiddenCardIds((prev) => {
      const next = new Set(prev);
      pendingAnimations.current.forEach(({ cardId }) => next.delete(cardId));
      return next;
    });
    // Remove suppression from slots whose action was rejected.
    setSuppressedSlotIds((prev) => {
      const next = new Set(prev);
      pendingAnimations.current.forEach((_, slotId) => next.delete(slotId));
      return next;
    });
    pendingAnimations.current.clear();
  }, [actionErrorSignal]);

  const handleFlyComplete = useCallback((cardId: string) => {
    setFlyingCards((prev) => prev.filter((fc) => fc.id !== cardId));
    setHiddenCardIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  const handleFieldSlotClickWithAnim = useCallback(
    (slotId: string, slotIndex: number) => {
      if (!selectedCard) {
        handleFieldSlotClick(slotId, slotIndex);
        return;
      }

      const cardEl = cardRefs.current.get(selectedCard.cardId);
      if (!cardEl) {
        handleFieldSlotClick(slotId, slotIndex);
        return;
      }

      const cardRect = cardEl.getBoundingClientRect();

      // Hide the card immediately so it doesn't remain in hand during flight.
      setHiddenCardIds((prev) => new Set(prev).add(selectedCard.cardId));
      // Suppress the slot entrance animation for when the card appears.
      setSuppressedSlotIds((prev) => new Set(prev).add(slotId));

      // Store start position — animation starts only after server confirms.
      pendingAnimations.current.set(slotId, {
        card: selectedCard,
        cardId: selectedCard.cardId,
        startX: cardRect.left,
        startY: cardRect.top,
      });

      // Send the action to the server immediately.
      handleFieldSlotClick(slotId, slotIndex);
    },
    [selectedCard, handleFieldSlotClick],
  );

  const handlePlantComplete = useCallback((id: string, opponentSlotId?: string) => {
    setPlantFlyingCards((prev) => prev.filter((fc) => fc.id !== id));
    // Reveal the slot card and clear suppression atomically so the card
    // appears in-place without the entrance spring animation.
    setAnimatingSlotIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSuppressedSlotIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (opponentSlotId) {
      setAnimatingOpponentSlotIds((prev) => {
        const next = new Set(prev);
        next.delete(opponentSlotId);
        return next;
      });
    }
  }, []);

  // A representative card for the draw deck back image.
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
      style={{ background: "#1a1008" }}
    >
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
          {players.map((player) => (
            <Player
              key={player.playerId}
              playerId={player.playerId}
              playerName={player.playerName}
              playerStatus="active"
              playerCoins={player.playerCoins}
              playerPickedCardsCount={player.playerPickedCardsCount}
              isCurrentTurn={player.playerId === playerTurn}
              gamePhase={phase}
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
                          if (el) opponentSlotRefs.current.set(slot.slotId, el);
                          else opponentSlotRefs.current.delete(slot.slotId);
                        }}
                      >
                        <Slot
                          slot={slot}
                          index={index}
                          interactive={false}
                          rotated={true}
                        >
                          {cardForSlot && (
                            <Card
                              card={cardForSlot}
                              flipped={false}
                              noTransition={true}
                              hidden={animatingOpponentSlotIds.has(slot.slotId)}
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
                    if (el) opponentHandContainerRefs.current.set(player.playerId, el);
                    else opponentHandContainerRefs.current.delete(player.playerId);
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
          ))}
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
              <Card
                key={card.cardId}
                ref={(el) => {
                  if (el) cardRefs.current.set(card.cardId, el);
                  else cardRefs.current.delete(card.cardId);
                }}
                card={card}
                isSelected={selectedCard?.cardId === card.cardId}
                draggable
                onClick={() => handleCardClick(card, "center")}
              />
            ))}
          </CenterCards>
          <CardPile
            label="Discard"
            count={discardPileSize}
            topCard={discardTopCard}
          />
        </Center>

        <CurrentPlayer
          coinCount={coins}
          field={
            <Field>
              {field.slots.map((s: SlotType, index: number) => {
                const cardForSlot = s.cardName
                  ? (cardLookup.get(s.cardName) ?? null)
                  : null;
                return (
                  <div
                    key={s.slotId}
                    ref={(el) => {
                      if (el) slotRefs.current.set(s.slotId, el);
                      else slotRefs.current.delete(s.slotId);
                    }}
                  >
                    <Slot
                      slot={s}
                      index={index}
                      dragOverSlot={dragOverSlot}
                      highlightEmpty={highlightEmpty}
                      handleDragOver={handleDragOver}
                      handleDragLeave={handleDragLeave}
                      handleFieldDrop={handleFieldDrop}
                      handleSlotClick={handleFieldSlotClickWithAnim}
                      suppressAnimation={suppressedSlotIds.has(s.slotId)}
                    >
                      {cardForSlot && (
                        <Card
                          card={cardForSlot}
                          flipped={false}
                          hidden={animatingSlotIds.has(s.slotId)}
                        />
                      )}
                    </Slot>
                  </div>
                );
              })}
            </Field>
          }
          tradedCards={<TradedCards />}
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
                  const isSelected = selectedCard?.cardId === card.cardId;
                  return (
                    <Card
                      key={card.cardId}
                      ref={(el) => {
                        if (el) cardRefs.current.set(card.cardId, el);
                        else cardRefs.current.delete(card.cardId);
                      }}
                      card={card}
                      isSelected={isSelected}
                      draggable={phase !== "plantTrade"}
                      onClick={() => handleCardClick(card, "hand")}
                      hidden={hiddenCardIds.has(card.cardId)}
                    />
                  );
                })}
              </FanLayout>
            </div>
          }
        />
      </Table>
    </div>
  );
}
