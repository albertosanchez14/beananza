"use client";

import { Offer, ExternalPlayer, CardType } from "@/schemas/types";
import OfferCardComponent from "@/components/offer-card";

type FilterType = "incoming" | "mine" | "all";

type OfferListProps = {
  offers: Offer[];
  filter: FilterType;
  myPlayerId: string;
  myHand: CardType[];
  players: ExternalPlayer[];
  gamePhase: string;
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onCancel: (offerId: string) => void;
  onCounter: (offerId: string) => void;
};

export default function OfferList({
  offers,
  filter,
  myPlayerId,
  myHand,
  players,
  gamePhase,
  onAccept,
  onReject,
  onCancel,
  onCounter,
}: OfferListProps) {
  // Only show root offers at the top level — children are rendered recursively
  // inside OfferCardComponent.
  const rootOffers = offers.filter((o) => o.parent_offer_id === "");

  const filteredRoots = rootOffers.filter((o) => {
    switch (filter) {
      case "mine":
        return o.creator_id === myPlayerId;
      case "incoming":
        // Offers created by others that are either open or targeting me
        return (
          o.creator_id !== myPlayerId &&
          (o.target_id === "" || o.target_id === myPlayerId)
        );
      case "all":
      default:
        return true;
    }
  });

  // Sort: pending first, then by creation time descending
  const sorted = [...filteredRoots].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-3xl mb-3">🤝</span>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {filter === "mine"
            ? "You haven't made any offers yet."
            : filter === "incoming"
              ? "No offers directed at you."
              : "No offers yet."}
        </p>
        {gamePhase === "turnTrade" && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Use the + button above to create one.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((offer) => (
        <OfferCardComponent
          key={offer.id}
          offer={offer}
          allOffers={offers}
          myPlayerId={myPlayerId}
          myHand={myHand}
          players={players}
          gamePhase={gamePhase}
          onAccept={onAccept}
          onReject={onReject}
          onCancel={onCancel}
          onCounter={onCounter}
        />
      ))}
    </div>
  );
}
