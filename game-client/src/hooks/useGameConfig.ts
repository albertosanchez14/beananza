import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CardType,
  CardTypeConfig,
  GameConfig,
  DEFAULT_GAME_CONFIG,
} from "@/schemas/types";

export type GameConfigState = {
  maxPlayers: number;
  minPlayers: number;
  cardsPerTurn: number;
  cardLookup: Map<string, CardType>;
  loading: boolean;
  error: string | null;
};

function toCardType(ct: CardTypeConfig): CardType {
  return {
    cardId: ct.name,
    cardName: ct.name,
    cardQuantity: ct.count,
    frontImage: ct.front_image,
    backImage: ct.back_image,
    money_exchange: ct.exchange_rates,
  };
}

async function fetchGameConfig(): Promise<GameConfig> {
  const res = await fetch("/config");
  if (!res.ok) {
    throw new Error(`GET /config returned ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches game configuration from GET /config once on mount.
 * Also builds a `cardLookup` map (card name → CardType) for use by board
 * components that need to render card images for opponents' fields.
 */
export function useGameConfig(): GameConfigState {
  const query = useQuery({
    queryKey: ["game-config"],
    queryFn: fetchGameConfig,
    staleTime: Infinity,
  });

  return useMemo(() => {
    const data = query.data ?? DEFAULT_GAME_CONFIG;
    const lookup = new Map<string, CardType>();

    for (const ct of data.card_types) {
      lookup.set(ct.name, toCardType(ct));
    }

    return {
      maxPlayers: data.max_players,
      minPlayers: data.min_players,
      cardsPerTurn: data.cards_per_turn,
      cardLookup: lookup,
      loading: query.isPending,
      error: query.error instanceof Error ? query.error.message : null,
    };
  }, [query.data, query.error, query.isPending]);
}
