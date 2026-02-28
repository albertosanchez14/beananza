"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";

import {
  CardType,
  ExternalPlayer,
  FieldType,
  Offer,
  OfferCard,
  WaitingPlayer,
} from "@/schemas/types";
import Board from "@/components/board";
import WaitingRoom from "@/components/waiting-room";
import OfferPanel from "@/components/offer-panel";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  // TODO: create a custom hook to track the playerid
  const [playerId, setPlayerId] = useState("");

  useEffect(() => {
    // Generate playerId only on client side to avoid hydration mismatch
    if (!playerId) {
      setPlayerId(Math.random().toString(36).substring(7));
    }
  }, [playerId]);

  // TODO: global hook?
  const WS_URL = "ws://localhost:8080/ws";
  const {
    sendJoin,
    sendLeave,
    isConnected,
    plantBean,
    tradeBean,
    harvestField,
    turnOverBean,
    drawCards,
    setReady,
    myState,
    nextPhase,
    createOffer,
    counterOffer,
    respondOffer,
  } = useActions({
    wsUrl: WS_URL,
    playerId,
    onMessage: (message) => {
      console.log("Room received message:", message);

      // Handle broadcast events
      if (message.type === "broadcast") {
        const broadcastPayload = message.payload as unknown as BroadcastPayload;

        switch (broadcastPayload.event) {
          case "player_joined": {
            console.log("Player joined:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "player_left": {
            console.log("Player left:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "player_ready": {
            console.log("Player ready changed:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "game_started": {
            console.log("Game started!");
            // Server sends myState automatically, but request it
            // as a fallback to ensure we transition to game phase
            myState(roomId);
            break;
          }
        }
      }

      // Handle state updates
      if (message.type === "myState" || message.type === "state") {
        const payload = message.payload as any;
        setPhase(payload.phase);

        // Game mode
        if (payload.player) {
          setMyHand(payload.player.hand || []);
          setMyPickedCards(payload.player.picked_cards || []);
          setMyField({
            ...payload.player.field,
            slots: payload.player.field?.slots || [],
          });
        }
        setCenterCards(payload.center_cards || []);
        setPlayers(payload.external_players || []);
        setOffers(payload.offers || []);

        if (payload.turn_order && payload.turn_order.length > 0) {
          const playerTurnId = payload.turn_order[payload.current_turn || 0];
          setPlayerTurn(playerTurnId);
        }
      } else if (message.type === "waitingLobbyState") {
        setPhase("waiting");
        const payload = message.payload as any;
        const waitingPlayers: Record<string, WaitingPlayer> =
          payload.players || {};
        setAllPlayers(waitingPlayers);
        setMinPlayers(payload.min_players || 3);
        setMaxPlayers(payload.max_players || 5);
        setCanStart(payload.can_start || false);

        const me = waitingPlayers[playerId];
        setMyReadyState(me?.ready || false);
      }
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
    },
  });

  // Waiting room state
  const [allPlayers, setAllPlayers] = useState<Record<string, WaitingPlayer>>(
    {},
  );
  const [minPlayers, setMinPlayers] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [canStart, setCanStart] = useState(false);
  const [myReadyState, setMyReadyState] = useState(false);

  // Game state
  const [myHand, setMyHand] = useState<CardType[]>([]);
  const [myPickedCards, setMyPickedCards] = useState<CardType[]>([]);
  const [myField, setMyField] = useState<FieldType>({ fieldId: "", slots: [] });
  const [centerCards, setCenterCards] = useState<CardType[]>([]);
  const [players, setPlayers] = useState<ExternalPlayer[]>([]);
  const [playerTurn, setPlayerTurn] = useState<string>("");
  const [gamePhase, setPhase] = useState<string>("");

  // Offer state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);

  // Auto-open offer panel when entering trade phase with pending incoming offers
  useEffect(() => {
    if (gamePhase === "turnTrade") {
      const hasIncoming = offers.some(
        (o) =>
          o.status === "pending" &&
          o.creator_id !== playerId &&
          (o.target_id === "" || o.target_id === playerId),
      );
      if (hasIncoming) {
        setOfferPanelOpen(true);
      }
    }
  }, [gamePhase, offers, playerId]);

  useEffect(() => {
    if (isConnected && playerId) {
      sendJoin(roomId, {
        player_name: `Player_${playerId}`,
      });
    }
  }, [isConnected, roomId, playerId, sendJoin]);

  // Action handler functions
  const handlePlantBean = (cardId: string, slotId: string) => {
    plantBean(roomId, playerId, cardId, slotId);
  };

  const handleTradeBean = (cardId: string, toPlayerId: string) => {
    tradeBean(roomId, playerId, toPlayerId, cardId);
  };

  const handleHarvestField = (slotId: string) => {
    harvestField(roomId, playerId, slotId);
  };

  const handleTurnOverBean = () => {
    turnOverBean(roomId);
  };

  const handleDrawCards = () => {
    drawCards(roomId);
  };

  const handleGetStatus = () => {
    myState(roomId);
  };

  const handleNextPhase = () => {
    nextPhase(roomId);
  };

  const handleCreateOffer = (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => {
    createOffer(roomId, cardsOffered, cardsRequested, targetPlayerId);
  };

  const handleCounterOffer = (
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => {
    counterOffer(roomId, parentOfferId, cardsOffered, cardsRequested);
  };

  const handleRespondOffer = (
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => {
    respondOffer(roomId, offerId, action);
  };

  const handleSetReady = (ready: boolean) => {
    setReady(roomId, ready);
  };

  const handleLeaveRoom = () => {
    sendLeave(roomId);
    router.push("/");
  };

  // Wait for playerId to be generated to avoid hydration mismatch
  if (!playerId) {
    return null;
  }

  const pendingIncomingCount = offers.filter(
    (o) =>
      o.status === "pending" &&
      o.creator_id !== playerId &&
      (o.target_id === "" || o.target_id === playerId),
  ).length;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-3xl flex-col items-center py-5 px-5 bg-white dark:bg-black">
        <h1 className="text-2xl font-bold mb-8">Room {roomId}</h1>

        {gamePhase === "waiting" ? (
          <WaitingRoom
            roomId={roomId}
            players={allPlayers}
            currentPlayerId={playerId}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
            canStart={canStart}
            myReadyState={myReadyState}
            onSetReady={handleSetReady}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <>
            {/* Left sidebar: player info + trade button */}
            <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
              <div className="flex flex-col gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 shadow text-xs text-gray-600 dark:text-gray-400 min-w-[120px]">
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {playerId}
                </span>
                <span>
                  Turn:{" "}
                  <span className={playerTurn === playerId ? "text-green-600 dark:text-green-400 font-semibold" : ""}>
                    {playerTurn === playerId ? "yours" : playerTurn}
                  </span>
                </span>
                <span>
                  Phase: <span className="font-medium text-gray-700 dark:text-gray-300">{gamePhase}</span>
                </span>
              </div>

              {gamePhase === "turnTrade" && (
                <button
                  onClick={() => setOfferPanelOpen(true)}
                  className="relative flex items-center justify-between gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
                >
                  <span>Trade Offers</span>
                  {pendingIncomingCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full leading-none">
                      {pendingIncomingCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            <Board
              myHand={myHand}
              myPickedCards={myPickedCards}
              myField={myField}
              players={players}
              centerCards={centerCards}
              currentTurnPlayerId={playerTurn}
              gamePhase={gamePhase}
              onPlantBean={handlePlantBean}
              onTradeBean={handleTradeBean}
              onHarvestField={handleHarvestField}
              onTurnOverBean={handleTurnOverBean}
              onDrawCards={handleDrawCards}
            />
          </>
        )}

        <div className="flex gap-4 pt-2">
          <button onClick={handleGetStatus}>Get Status</button>
          <button onClick={handleNextPhase}>Next Phase</button>
        </div>
      </main>

      <OfferPanel
        isOpen={offerPanelOpen}
        onClose={() => setOfferPanelOpen(false)}
        offers={offers}
        myHand={myHand}
        centerCards={centerCards}
        myPlayerId={playerId}
        players={players}
        gamePhase={gamePhase}
        onCreateOffer={handleCreateOffer}
        onCounterOffer={handleCounterOffer}
        onRespondOffer={handleRespondOffer}
      />
    </div>
  );
}
