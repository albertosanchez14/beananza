import { CardType, Slot } from "@/schemas/types";
import Table from "./table";
import { useRef } from "react";
import { CardPile, CenterCards } from "@/components/card-pile";
import Opponents from "@/components/opponents";
import Center from "@/components/center";
import CurrentPlayer from "./current-player";
import NewSlot from "./new-slot";
import NewField from "./new-field";
import TradedCards from "./traded-cards";
import PlayerHand from "./player-hand";
import { useGameContext } from "./game-context";
import Card from "./card";

export default function Board() {
  const {
    gameState,
    selectedCard,
    cardsPerTurn,
    cardLookup,
    handleCardClick,
    handleDrawDeckClick,
  } = useGameContext();

  const {
    centerCards,
    discardTopCard,
    deckSize,
    discardPileSize,
    players,
    playerTurn,
    phase,
    field,
    coins,
  } = gameState;

  // Ref forwarded to DrawDeck so CenterCards can measure deal animation offset.
  const deckRef = useRef<HTMLDivElement>(null);

  // A representative card for the draw deck back image.
  // Prefer a real card from the live game state (which carries backImage from the server),
  // but fall back to the first entry in cardLookup so the back image is always available
  // even before any cards have been dealt/discarded.
  const anyCardWithBack: CardType =
    centerCards[0] ??
    discardTopCard ??
    [...cardLookup.values()][0] ??
    { cardId: "__deck__", cardName: "", backImage: "" };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#1a1008" }}
    >
      <Table>
        <Opponents
          players={players}
          currentTurnPlayerId={playerTurn}
          cardLookup={cardLookup}
          gamePhase={phase}
        />
        <Center>
          <CardPile
            label="Draw"
            count={deckSize}
            topCard={anyCardWithBack}
            onClickAction={handleDrawDeckClick}
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
        </Center>
        <CurrentPlayer
          coinCount={coins}
          field={
            <NewField>
              {field.slots.map((s: Slot, index: number) => {
                const cardForSlot = cardLookup.get(s.cardName) ?? null;
                return (
                  <NewSlot key={s.slotId} slot={s} index={index}>
                    {cardForSlot && <Card card={cardForSlot} flipped={false} />}
                  </NewSlot>
                );
              })}
            </NewField>
          }
          tradedCards={<TradedCards />}
          hand={<PlayerHand />}
        />
      </Table>
    </div>
  );
}
