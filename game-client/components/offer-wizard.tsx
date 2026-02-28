"use client";

import { useState } from "react";
import { CardType, ExternalPlayer, OfferCard, CARD_TYPES } from "@/schemas/types";

type WizardMode = "create" | "counter";

type OfferWizardProps = {
  mode: WizardMode;
  myHand: CardType[];
  centerCards: CardType[];
  players: ExternalPlayer[];
  myPlayerId: string;
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
  parentOfferCreatorId,
  onSubmit,
  onCancel,
}: OfferWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1: cards to offer (from hand, by card ID)
  const [selectedOffered, setSelectedOffered] = useState<OfferCard[]>([]);

  // Step 2: cards to request (by type + quantity)
  const [requestedEntries, setRequestedEntries] = useState<RequestedEntry[]>([]);
  const [selectedType, setSelectedType] = useState<string>(CARD_TYPES[0]);
  const [selectedQty, setSelectedQty] = useState(1);

  // Step 3: target player (skip in counter mode — target is fixed)
  const [targetPlayerId, setTargetPlayerId] = useState<string>("");

  // Derived: unique card types in hand for grouping display
  const handByType = myHand.reduce<Record<string, CardType[]>>((acc, card) => {
    acc[card.cardName] = acc[card.cardName] ?? [];
    acc[card.cardName].push(card);
    return acc;
  }, {});

  const isOffered = (cardId: string) =>
    selectedOffered.some((c) => c.card_id === cardId);

  const toggleOfferedCard = (card: CardType) => {
    if (isOffered(card.cardId)) {
      setSelectedOffered((prev) => prev.filter((c) => c.card_id !== card.cardId));
    } else {
      setSelectedOffered((prev) => [
        ...prev,
        { card_type: card.cardName, card_id: card.cardId },
      ]);
    }
  };

  const removeOffered = (cardId: string) =>
    setSelectedOffered((prev) => prev.filter((c) => c.card_id !== cardId));

  const addRequested = () => {
    if (selectedQty < 1) return;
    setRequestedEntries((prev) => {
      const existing = prev.findIndex((e) => e.card_type === selectedType);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + selectedQty };
        return next;
      }
      return [...prev, { card_type: selectedType, quantity: selectedQty }];
    });
    setSelectedQty(1);
  };

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
      mode === "counter"
        ? parentOfferCreatorId
        : targetPlayerId || undefined;
    onSubmit(selectedOffered, cardsRequested, target);
  };

  const stepTitles: Record<number, string> = {
    1: mode === "counter" ? "Counter — Cards to Offer" : "Create Offer — Cards to Offer",
    2: "Cards to Request",
    3: "Target Player",
  };

  const totalSteps = mode === "counter" ? 2 : 3;

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
              <div className={`h-0.5 w-6 ${s < step ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
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

      {/* ── Step 1: Pick cards from hand ── */}
      {step === 1 && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select one or more cards from your hand to put on the table.
          </p>

          {/* Hand grouped by type */}
          <div className="flex flex-col gap-2">
            {Object.entries(handByType).map(([typeName, cards]) => (
              <div key={typeName}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {typeName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cards.map((card) => (
                    <button
                      key={card.cardId}
                      onClick={() => toggleOfferedCard(card)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium border-2 transition-all duration-150
                        ${isOffered(card.cardId)
                          ? "bg-blue-500 border-blue-600 text-white shadow-md -translate-y-0.5"
                          : "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50"
                        }`}
                    >
                      {card.cardName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {myHand.length === 0 && (
              <p className="text-xs text-gray-400 italic">Your hand is empty.</p>
            )}
          </div>

          {/* Center cards — only shown in create mode when cards are available */}
          {mode === "create" && centerCards.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                Center cards (turned over)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {centerCards.map((card) => (
                  <button
                    key={card.cardId}
                    onClick={() => toggleOfferedCard(card)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border-2 transition-all duration-150
                      ${isOffered(card.cardId)
                        ? "bg-amber-500 border-amber-600 text-white shadow-md -translate-y-0.5"
                        : "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                      }`}
                  >
                    {card.cardName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected chips */}
          {selectedOffered.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Offering ({selectedOffered.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedOffered.map((oc) => (
                  <span
                    key={oc.card_id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded-full border border-blue-300 dark:border-blue-600"
                  >
                    {oc.card_type}
                    <button
                      onClick={() => removeOffered(oc.card_id)}
                      className="ml-0.5 text-blue-500 hover:text-red-500 font-bold leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Specify cards to request ── */}
      {step === 2 && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optionally specify what you want in return. Leave empty to make an unconditional offer.
          </p>

          {/* Type + qty picker */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Card type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1.5 text-gray-800 dark:text-gray-200"
              >
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Qty
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedQty}
                </span>
                <button
                  onClick={() => setSelectedQty((q) => Math.min(20, q + 1))}
                  className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={addRequested}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-md transition-colors"
            >
              Add
            </button>
          </div>

          {/* Requested chips */}
          {requestedEntries.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Requesting:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requestedEntries.map((e) => (
                  <span
                    key={e.card_type}
                    className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded-full border border-green-300 dark:border-green-600"
                  >
                    {e.card_type} ×{e.quantity}
                    <button
                      onClick={() => removeRequested(e.card_type)}
                      className="ml-0.5 text-green-500 hover:text-red-500 font-bold leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              No cards requested yet — offer will be unconditional.
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
            <span className="ml-auto text-xs text-gray-400">(any player can respond)</span>
          </label>
          {players
            .filter((p) => p.playerId !== myPlayerId)
            .map((p) => (
              <label
                key={p.playerId}
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors
                  ${targetPlayerId === p.playerId
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
            disabled={step === 1 && selectedOffered.length === 0}
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
