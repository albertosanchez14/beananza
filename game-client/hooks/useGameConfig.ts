"use client";

import { useEffect, useState } from "react";
import { CardType, CardTypeConfig, GameConfig } from "@/schemas/types";
import { apiBaseUrl } from "@/lib/config";

export type { GameConfig, CardTypeConfig };

export type GameConfigState = {
  config: GameConfig | null;
  /** A lookup map from card name → CardType (for rendering card images/exchange rates). */
  cardLookup: Map<string, CardType>;
  loading: boolean;
  error: string | null;
};

/** Converts a CardTypeConfig from /config into the CardType shape used by UI components. */
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
    config: null,
    cardLookup: new Map(),
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
        console.log("data", data);

        const lookup = new Map<string, CardType>();
        for (const ct of data.cards.card_types) {
          lookup.set(ct.name, toCardType(ct));
        }
        console.log("state", lookup);

        if (!cancelled) {
          setState({
            config: data,
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
