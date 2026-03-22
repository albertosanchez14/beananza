"use client";

import { useState } from "react";
import { Offer, OfferCard, ExternalPlayer, CardType } from "@/schemas/types";
import OfferList from "@/components/offer-list";
import OfferWizard from "@/components/offer-wizard";

type FilterTab = "incoming" | "mine" | "all";

type WizardState =
  | { mode: "create" }
  | { mode: "counter"; parentOfferId: string; parentOfferCreatorId: string };

type OfferPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  offers: Offer[];
  myHand: CardType[];
  centerCards: CardType[];
  myPlayerId: string;
  players: ExternalPlayer[];
  gamePhase: string;
  playerTurn: string;
  onCreateOffer: (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => void;
  onCounterOffer: (
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => void;
  onRespondOffer: (offerId: string, action: "accept" | "reject" | "cancel") => void;
};

export default function OfferPanel({
  isOpen,
  onClose,
  offers,
  myHand,
  centerCards,
  myPlayerId,
  players,
  gamePhase,
  playerTurn,
  onCreateOffer,
  onCounterOffer,
  onRespondOffer,
}: OfferPanelProps) {
  const isTurnPlayer = myPlayerId === playerTurn;
  const [activeTab, setActiveTab] = useState<FilterTab>("incoming");
  const [wizard, setWizard] = useState<WizardState | null>(null);

  const pendingIncoming = offers.filter(
    (o) =>
      o.status === "pending" &&
      o.creator_id !== myPlayerId &&
      (o.target_id === "" || o.target_id === myPlayerId) &&
      o.parent_offer_id === "",
  ).length;

  const pendingMine = offers.filter(
    (o) =>
      o.status === "pending" &&
      o.creator_id === myPlayerId &&
      o.parent_offer_id === "",
  ).length;

  const handleWizardSubmit = (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => {
    if (!wizard) return;
    if (wizard.mode === "create") {
      onCreateOffer(cardsOffered, cardsRequested, targetPlayerId);
    } else {
      onCounterOffer(wizard.parentOfferId, cardsOffered, cardsRequested);
    }
    setWizard(null);
  };

  const handleCounter = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) return;
    setWizard({
      mode: "counter",
      parentOfferId: offerId,
      parentOfferCreatorId: offer.creator_id,
    });
  };

  const tabs: { key: FilterTab; label: string; badge?: number }[] = [
    { key: "incoming", label: "Incoming", badge: pendingIncoming || undefined },
    { key: "mine", label: "Mine", badge: pendingMine || undefined },
    { key: "all", label: "All" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-[100vw] z-50 flex flex-col
          bg-white dark:bg-gray-900 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-blue-500 to-purple-600">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤝</span>
            <h2 className="text-base font-bold text-white">Trade Offers</h2>
          </div>
          <div className="flex items-center gap-2">
            {gamePhase === "turnTrade" && !wizard && (
              <button
                onClick={() => setWizard({ mode: "create" })}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + New Offer
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Phase notice */}
        {gamePhase !== "turnTrade" && (
          <div className="mx-4 mt-3 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Offers can only be created during the <strong>Trade phase</strong>. You can still view existing offers.
            </p>
          </div>
        )}

        {wizard ? (
          /* Wizard view */
          <div className="flex flex-col flex-1 overflow-hidden px-4 py-4">
            <OfferWizard
              mode={wizard.mode}
              myHand={myHand}
              centerCards={isTurnPlayer ? centerCards : []}
              players={players}
              myPlayerId={myPlayerId}
              isTurnPlayer={isTurnPlayer}
              turnPlayerId={playerTurn}
              parentOfferId={wizard.mode === "counter" ? wizard.parentOfferId : undefined}
              parentOfferCreatorId={
                wizard.mode === "counter" ? wizard.parentOfferCreatorId : undefined
              }
              onSubmit={handleWizardSubmit}
              onCancel={() => setWizard(null)}
            />
          </div>
        ) : (
          /* List view */
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 pt-3">
              {tabs.map(({ key, label, badge }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 pb-2 px-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === key
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  {label}
                  {badge !== undefined && (
                    <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full leading-none">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Offer list */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <OfferList
                offers={offers}
                filter={activeTab}
                myPlayerId={myPlayerId}
                myHand={myHand}
                centerCards={centerCards}
                players={players}
                gamePhase={gamePhase}
                playerTurn={playerTurn}
                onAccept={(id) => onRespondOffer(id, "accept")}
                onReject={(id) => onRespondOffer(id, "reject")}
                onCancel={(id) => onRespondOffer(id, "cancel")}
                onCounter={handleCounter}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
