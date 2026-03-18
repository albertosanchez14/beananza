"use client";

import { useState } from "react";
import {
  CardType,
  ExternalPlayer,
  OfferCard,
  CARD_TYPES,
} from "@/schemas/types";
import CardComponent from "@/components/card";
import { useGameContext } from "@/components/game-context";

const CARD_H = 144;
const LAYER_H = 4;
const MAX_PEEK = 3;

type WizardMode = "create" | "counter";

type OfferWizardProps = {
  mode: WizardMode;
  myHand: CardType[];
  centerCards: CardType[];
  players: ExternalPlayer[];
  myPlayerId: string;
  isTurnPlayer: boolean;
  turnPlayerId: string;
  parentOfferId?: string; // only for counter mode
  parentOfferCreatorId?: string; // only for counter mode — auto-set as target
  onSubmit: (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => void;
  onCancel: () => void;
};

type RequestedEntry = {
  card_type: string;
  quantity: number;
};

export default function OfferWizard({
  mode,
  myHand,
  centerCards,
  players,
  myPlayerId,
  isTurnPlayer,
  turnPlayerId,
  parentOfferCreatorId,
  onSubmit,
  onCancel,
}: OfferWizardProps) {
  const { cardLookup } = useGameContext();
  const [step, setStep] = useState(1);

  // Step 2: cards to offer (from hand, by card ID)
  const [selectedOffered, setSelectedOffered] = useState<OfferCard[]>([]);

  // Step 1: cards to request (by type + quantity)
  const [requestedEntries, setRequestedEntries] = useState<RequestedEntry[]>(
    [],
  );
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [stagingQty, setStagingQty] = useState(1);

  // Step 3: target player (skip in counter mode or when not turn player)
  // Non-turn players must always target the turn player.
  const [targetPlayerId, setTargetPlayerId] = useState<string>(
    !isTurnPlayer && mode === "create" ? turnPlayerId : "",
  );

  const isOffered = (cardId: string) =>
    selectedOffered.some((c) => c.card_id === cardId);

  const toggleOfferedCard = (card: CardType) => {
    if (isOffered(card.cardId)) {
      setSelectedOffered((prev) =>
        prev.filter((c) => c.card_id !== card.cardId),
      );
    } else {
      setSelectedOffered((prev) => [
        ...prev,
        { card_type: card.cardName, card_id: card.cardId },
      ]);
    }
  };

  const currentType = CARD_TYPES[carouselIndex];

  const currentRequestedQty = (type: string): number =>
    requestedEntries.find((e) => e.card_type === type)?.quantity ?? 0;

  const navigate = (dir: number) => {
    const newIndex =
      (carouselIndex + dir + CARD_TYPES.length) % CARD_TYPES.length;
    setCarouselIndex(newIndex);
    setStagingQty(Math.max(1, currentRequestedQty(CARD_TYPES[newIndex])));
  };

  const setRequestedQty = (type: string, qty: number) => {
    if (qty <= 0) {
      setRequestedEntries((prev) => prev.filter((e) => e.card_type !== type));
    } else {
      setRequestedEntries((prev) => {
        const existing = prev.findIndex((e) => e.card_type === type);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { ...next[existing], quantity: qty };
          return next;
        }
        return [...prev, { card_type: type, quantity: qty }];
      });
    }
  };

  const confirmCurrent = () => setRequestedQty(currentType, stagingQty);

  const removeRequested = (cardType: string) =>
    setRequestedEntries((prev) => prev.filter((e) => e.card_type !== cardType));

  // Expand requested entries into flat OfferCard array (card_id is empty for requested)
  const buildCardsRequested = (): OfferCard[] =>
    requestedEntries.flatMap(({ card_type, quantity }) =>
      Array.from({ length: quantity }, () => ({ card_type, card_id: "" })),
    );

  const handleSubmit = () => {
    const cardsRequested = buildCardsRequested();
    const target =
      mode === "counter" ? parentOfferCreatorId : targetPlayerId || undefined;
    onSubmit(selectedOffered, cardsRequested, target);
  };

  const stepTitles: Record<number, string> = {
    1: "Cards to Request",
    2: mode === "counter" ? "Counter — Cards to Offer" : "Cards to Offer",
    3: "Target Player",
  };

  // Non-turn players creating an offer skip step 3 (target is always the turn player).
  const totalSteps = mode === "counter" || !isTurnPlayer ? 2 : 3;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${s < step ? "bg-blue-500 text-white" : s === step ? "bg-blue-600 text-white ring-2 ring-blue-300" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < totalSteps && (
              <div
                className={`h-0.5 w-6 ${s < step ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          Step {step}/{totalSteps}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {stepTitles[step]}
      </h3>

      {/* ── Step 1: Specify cards to request ── */}
      {step === 1 && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optionally specify what you want in return. Leave empty to make an
            unconditional offer.
          </p>

          {/* Carousel + controls */}
          <div className="flex items-center gap-3">
            {/* ← / card slot / → */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(-1)}
                className="w-7 h-7 rounded-full border border-gray-300 dark:border-gray-600 
								text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
								font-bold text-sm flex items-center justify-center"
              >
                ←
              </button>
              <div className="shrink-0">
                {(() => {
                  const peekLayers = Math.min(
                    Math.max(stagingQty - 1, 0),
                    MAX_PEEK,
                  );
                  const slotH = CARD_H + MAX_PEEK * LAYER_H;
                  return (
                    <div
                      className="relative"
                      style={{ width: 96, height: slotH }}
                    >
                      {stagingQty > 0 &&
                        Array.from({ length: peekLayers }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute rounded-2xl border-2"
                            style={{
                              width: 96,
                              height: CARD_H,
                              bottom: i * LAYER_H,
                              left: 0,
                              zIndex: peekLayers - i,
                              background: "#4a6478",
                              borderColor: "#344d5c",
                            }}
                          />
                        ))}
                      <div
                        className="absolute left-0"
                        style={{
                          bottom: peekLayers * LAYER_H,
                          zIndex: peekLayers + 1,
                        }}
                      >
                        {cardLookup.get(currentType) ? (
                          <CardComponent
                            card={cardLookup.get(currentType)!}
                            noTransition
                          />
                        ) : (
                          <div
                            className="w-24 h-36 rounded-2xl border-2 border-dashed 
													border-gray-300 dark:border-gray-600 flex items-center justify-center"
                          >
                            <span className="text-xs text-gray-500 text-center px-1">
                              {currentType}
                            </span>
                          </div>
                        )}
                      </div>
                      {stagingQty > 1 && (
                        <div
                          className="absolute flex items-center justify-center w-5 h-5 
													bg-blue-500 text-white text-xs font-bold rounded-full pointer-events-none"
                          style={{
                            bottom: peekLayers * LAYER_H + CARD_H - 22,
                            left: 4,
                            zIndex: peekLayers + 2,
                          }}
                        >
                          {stagingQty}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => navigate(1)}
                className="w-7 h-7 rounded-full border border-gray-300 dark:border-gray-600 
								text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
								font-bold text-sm flex items-center justify-center"
              >
                →
              </button>
            </div>

            {/* Qty + confirm column */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStagingQty((q) => Math.max(1, q - 1))}
                  disabled={stagingQty === 1}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-9 text-center text-lg font-bold text-gray-700 dark:text-gray-300">
                  {stagingQty}
                </span>
                <button
                  onClick={() => setStagingQty((q) => q + 1)}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-lg flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <button
                onClick={confirmCurrent}
                className="w-full px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                {currentRequestedQty(currentType) > 0 ? "✓ Update" : "+ Add"}
              </button>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Requested
            </p>
          </div>

          {/* Confirmed grid */}
          {requestedEntries.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {requestedEntries.map((e) => {
                const card = cardLookup.get(e.card_type);
                const peekLayers = Math.min(e.quantity - 1, MAX_PEEK);
                const containerH = CARD_H + peekLayers * LAYER_H;
                return (
                  <div
                    key={e.card_type}
                    className="relative cursor-pointer"
                    style={{ width: 96, height: containerH }}
                    onClick={() => removeRequested(e.card_type)}
                    title={`Remove ${e.card_type}`}
                  >
                    {Array.from({ length: peekLayers }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute rounded-2xl border-2"
                        style={{
                          width: 96,
                          height: CARD_H,
                          bottom: i * LAYER_H,
                          left: 0,
                          zIndex: peekLayers - i,
                          background: "#4a6478",
                          borderColor: "#344d5c",
                        }}
                      />
                    ))}
                    <div
                      className="absolute left-0"
                      style={{
                        bottom: peekLayers * LAYER_H,
                        zIndex: peekLayers + 1,
                      }}
                    >
                      {card ? (
                        <CardComponent card={card} noTransition />
                      ) : (
                        <div className="w-24 h-36 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                          <span className="text-xs text-gray-500 text-center px-1">
                            {e.card_type}
                          </span>
                        </div>
                      )}
                    </div>
                    {e.quantity > 1 && (
                      <div
                        className="absolute flex items-center justify-center w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full pointer-events-none"
                        style={{
                          bottom: peekLayers * LAYER_H + CARD_H - 22,
                          left: 4,
                          zIndex: peekLayers + 2,
                        }}
                      >
                        {e.quantity}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              No cards requested yet — offer will be unconditional.
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Pick cards from hand ── */}
      {step === 2 && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tap a card to include it in your offer.
          </p>
          {!isTurnPlayer && mode === "create" && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                You are not the turn player — your offer will be directed at the
                current player.
              </p>
            </div>
          )}

          {/* Hand cards */}
          {myHand.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Your hand is empty.</p>
          ) : (
            <div className="flex flex-wrap gap-3 justify-start">
              {[...myHand]
                .sort((a, b) => a.cardName.localeCompare(b.cardName))
                .map((card) => (
                  <CardComponent
                    key={card.cardId}
                    card={card}
                    isSelected={isOffered(card.cardId)}
                    onClick={() => toggleOfferedCard(card)}
                    noTransition
                  />
                ))}
            </div>
          )}

          {/* Center cards */}
          {centerCards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                Center cards
              </p>
              <div className="flex flex-wrap gap-3 justify-start">
                {[...centerCards]
                  .sort((a, b) => a.cardName.localeCompare(b.cardName))
                  .map((card) => (
                    <CardComponent
                      key={card.cardId}
                      card={card}
                      isSelected={isOffered(card.cardId)}
                      onClick={() => toggleOfferedCard(card)}
                      noTransition
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Selected count */}
          {selectedOffered.length > 0 && (
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {selectedOffered.length} card
              {selectedOffered.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Target player (create mode only) ── */}
      {step === 3 && mode === "create" && (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optionally direct this offer at a specific player, or leave it open.
          </p>
          <label className="flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors border-blue-400 bg-blue-50 dark:bg-blue-900/20">
            <input
              type="radio"
              name="target"
              value=""
              checked={targetPlayerId === ""}
              onChange={() => setTargetPlayerId("")}
              className="accent-blue-500"
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Open to everyone
            </span>
            <span className="ml-auto text-xs text-gray-400">
              (any player can respond)
            </span>
          </label>
          {players
            .filter((p) => p.playerId !== myPlayerId)
            .map((p) => (
              <label
                key={p.playerId}
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors
                  ${
                    targetPlayerId === p.playerId
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300"
                  }`}
              >
                <input
                  type="radio"
                  name="target"
                  value={p.playerId}
                  checked={targetPlayerId === p.playerId}
                  onChange={() => setTargetPlayerId(p.playerId)}
                  className="accent-blue-500"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">
                  {p.playerName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  🃏 {p.playerHandSize} &nbsp;💰 {p.playerCoins}
                </span>
              </label>
            ))}
        </div>
      )}

      {/* ── Navigation buttons ── */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
          className="flex-1 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {step === 1 ? "Cancel" : "← Back"}
        </button>

        {step < totalSteps ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && selectedOffered.length === 0}
            className="flex-1 py-2 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={selectedOffered.length === 0}
            className="flex-1 py-2 px-3 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {mode === "counter" ? "Submit Counter" : "Create Offer"}
          </button>
        )}
      </div>
    </div>
  );
}
