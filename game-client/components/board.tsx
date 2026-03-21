import { CardType, ExternalPlayer, SlotType } from "@/schemas/types";
import { useGameContext } from "@/components/game-context";

import { useState } from "react";
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
    animatingSlot,
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
      <Table>
        <Opponents>
          {players.map((player) => {
            const isTurnPlayer = myPlayerId === playerTurn;
            const isEligibleTarget =
              phase === "turnTrade" &&
              (isTurnPlayer || player.playerId === playerTurn);

            const handlePlayerDragOver = isEligibleTarget
              ? (e: React.DragEvent) => {
                  if (!isTurnPlayer && e.dataTransfer.types.includes("application/center-card")) return;
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
                        const isCenterCard = centerCards.some((cc) => cc.cardId === c.cardId);
                        if (!isTurnPlayer && isCenterCard) continue;
                        cardsToGive.push(c);
                      }
                    }
                    clearGiveSelection();
                    if (cardsToGive.length > 0) onGiveDrop(player as ExternalPlayer, cardsToGive);
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
                                ? () => onCardRightClick(cardForSlot, player.playerId)
                                : undefined
                            }
                          />
                        )}
                      </Slot>
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
            );
          })}
        </Opponents>
        <Center>
          <CardPile
            label="Draw"
            count={deckSize}
            topCard={anyCardWithBack}
            onClickAction={handleDrawDeckClick}
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
        <CurrentPlayer
          coinCount={coins}
          field={
            <Field>
              {field.slots.map((s: SlotType, index: number) => {
                const cardForSlot = s.cardName
                  ? (cardLookup.get(s.cardName) ?? null)
                  : null;
                return (
                  <Slot
                    key={s.slotId}
                    slot={s}
                    index={index}
                    dragOverSlot={dragOverSlot}
                    animatingSlot={animatingSlot}
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
                            ? () => onCardRightClick(cardForSlot, isTurnPlayer ? undefined : playerTurn)
                            : undefined
                        }
                      />
                    )}
                  </Slot>
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
                dragOverTraded ? "bg-blue-500/20 ring-2 ring-blue-400 ring-inset" : "",
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
                    isSelected={isSelected}
                    draggable={phase !== "plantTrade"}
                    onClick={() => handleCardClick(card, "hand")}
                    onContextMenu={
                      phase === "turnTrade"
                        ? () => onCardRightClick(card, isTurnPlayer ? undefined : playerTurn)
                        : undefined
                    }
                  />
                );
              })}
            </FanLayout>
          }
        />
      </Table>
    </div>
  );
}
