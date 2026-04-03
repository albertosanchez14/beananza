"use client";

import { useEffect, useState } from "react";
import {
  CardType,
  CardTypeConfig,
  GameConfig,
  DEFAULT_GAME_CONFIG,
} from "@/schemas/types";
import { apiBaseUrl } from "@/lib/config";

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
    frontImage: ct.front_image,
    backImage: ct.back_image,
    money_exchange: ct.exchange_rates,
  };
}

/**
 * Fetches game configuration from GET /config once on mount.
 * Also builds a `cardLookup` map (card name → CardType) for use by board
 * components that need to render card images for opponents' fields.
 */
export function useGameConfig(): GameConfigState {
  const [state, setState] = useState<GameConfigState>({
    maxPlayers: DEFAULT_GAME_CONFIG.max_players,
    minPlayers: DEFAULT_GAME_CONFIG.min_players,
    cardsPerTurn: DEFAULT_GAME_CONFIG.cards_per_turn,
    cardLookup: new Map(
      DEFAULT_GAME_CONFIG.card_types.map((ct) => [ct.name, toCardType(ct)]),
    ),
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/config`);
        if (!res.ok) {
          throw new Error(`GET /config returned ${res.status}`);
        }
        const data: GameConfig = await res.json();

        const lookup = new Map<string, CardType>();
        for (const ct of data.card_types) {
          lookup.set(ct.name, toCardType(ct));
        }

        if (!cancelled) {
          setState({
            maxPlayers: data.max_players,
            minPlayers: data.min_players,
            cardsPerTurn: data.cards_per_turn,
            cardLookup: lookup,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load config",
          }));
        }
      }
    };

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
