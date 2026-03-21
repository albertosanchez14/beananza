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
    animatingSlot,
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
          ))}
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
              <Card
                key={card.cardId}
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
                  {cardForSlot && <Card card={cardForSlot} flipped={false} />}
                </Slot>
              );
            })}
          </Field>
        }
        tradedCards={<TradedCards />}
        hand={
          <FanLayout phase={phase}>
            {hand.map((card) => {
              const isSelected = selectedCard?.cardId === card.cardId;
              return (
                <Card
                  key={card.cardId}
                  card={card}
                  isSelected={isSelected}
                  draggable={phase !== "plantTrade"}
                  onClick={() => handleCardClick(card, "hand")}
                />
              );
            })}
          </FanLayout>
        }
      />
    </div>
  );
}
