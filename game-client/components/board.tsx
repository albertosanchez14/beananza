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
  const pendingPlantActions = useRef<Map<string, number>>(new Map());
  const prevHandRef = useRef<CardType[]>(hand);
  const prevPlayersRef = useRef(players);

  const [flyingCards, setFlyingCards] = useState<FlyingCardEntry[]>([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
  const [plantFlyingCards, setPlantFlyingCards] = useState<
    PlantFlyingCardEntry[]
  >([]);
  const [suppressedSlotIds, setSuppressedSlotIds] = useState<Set<string>>(
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
    const prev = prevPlayersRef.current;
    const newFlying: PlantFlyingCardEntry[] = [];

    players.forEach((player) => {
      const prevPlayer = prev.find((p) => p.playerId === player.playerId);
      player.playerField.slots.forEach((slot) => {
        const prevSlot = prevPlayer?.playerField.slots.find(
          (s) => s.slotId === slot.slotId,
        );
        const prevCount = prevSlot?.cardIds.length ?? 0;
        if (slot.cardIds.length > prevCount && slot.cardName) {
          const slotEl = opponentSlotRefs.current.get(slot.slotId);
          if (!slotEl || !deckRef.current) return;
          const deckRect = deckRef.current.getBoundingClientRect();
          const slotRect = slotEl.getBoundingClientRect();
          newFlying.push({
            id: `${slot.slotId}-${slot.cardIds.length}`,
            card: cardLookup.get(slot.cardName) ?? {
              cardId: slot.cardIds.at(-1)!,
              cardName: slot.cardName,
              backImage: "",
            },
            startX: deckRect.left + (deckRect.width - 96) / 2,
            startY: deckRect.top + (deckRect.height - 144) / 2,
            targetX: slotRect.left + (slotRect.width - 96) / 2,
            targetY: slotRect.bottom - 144,
            targetRotateX: 25,
            targetScaleX: 1.08,
          });
        }
      });
    });

    if (newFlying.length > 0) {
      setPlantFlyingCards((prev) => [...prev, ...newFlying]);
    }

    prevPlayersRef.current = players;
  }, [players, cardLookup]);

  // Remove slot suppression only once the card is confirmed in the game
  // state — the server round-trip means the card can appear well after the
  // requestAnimationFrame window, so we watch field directly.
  useLayoutEffect(() => {
    setSuppressedSlotIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      field.slots.forEach((s) => {
        if (s.cardName && prev.has(s.slotId)) next.delete(s.slotId);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [field]);

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
      const slotEl = slotRefs.current.get(slotId);
      if (!cardEl || !slotEl) {
        handleFieldSlotClick(slotId, slotIndex);
        return;
      }

      const cardRect = cardEl.getBoundingClientRect();
      const slotRect = slotEl.getBoundingClientRect();

      setSuppressedSlotIds((prev) => new Set(prev).add(slotId));
      setHiddenCardIds((prev) => new Set(prev).add(selectedCard.cardId));

      pendingPlantActions.current.set(slotId, slotIndex);

      setPlantFlyingCards((prev) => [
        ...prev,
        {
          id: slotId,
          slotIndex,
          card: selectedCard,
          startX: cardRect.left,
          startY: cardRect.top,
          targetX: slotRect.left + (slotRect.width - 96) / 2,
          targetY: slotRect.bottom - 144,
          targetRotateX: 25,
          targetScaleX: 1.08,
        },
      ]);
    },
    [selectedCard, handleFieldSlotClick],
  );

  const handlePlantComplete = useCallback(
    (slotId: string) => {
      // Fire the game action first so the card appears in the slot.
      const slotIndex = pendingPlantActions.current.get(slotId);
      if (slotIndex !== undefined) {
        handleFieldSlotClick(slotId, slotIndex);
        pendingPlantActions.current.delete(slotId);
      }
      setPlantFlyingCards((prev) => prev.filter((fc) => fc.id !== slotId));
    },
    [handleFieldSlotClick],
  );

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
          onComplete={() => handlePlantComplete(fc.id)}
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
                            />
                          )}
                        </Slot>
                      </div>
                    );
                  })}
                </Field>
              }
              hand={
                <FanLayout variant="opponent" maxCards={12}>
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
                        <Card card={cardForSlot} flipped={false} />
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
