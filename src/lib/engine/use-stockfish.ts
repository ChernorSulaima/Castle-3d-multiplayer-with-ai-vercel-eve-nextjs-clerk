"use client";
// src/lib/engine/use-stockfish.ts
//
// Owns the Stockfish worker for the lifetime of an AI game. Lazy (nothing is
// fetched until `enabled` is true), shared through the refcounted singleton in
// stockfish-client.ts, and terminated on unmount (NFR-3, §I-1).
//
// Engine status is mirrored into the zustand ai-store rather than React state:
// `react-hooks/set-state-in-effect` is an error in this repo (§D.12 rule 6), and a
// store write from an effect or a worker callback is explicitly allowed.
import { useCallback, useEffect, useRef } from "react";
import { useAiStore } from "@/lib/stores/ai-store";
import type { EngineStatus } from "@/lib/types";
import {
  acquireEngine,
  releaseEngine,
  EngineUnavailableError,
  type SearchRequest,
  type SearchResult,
  type StockfishEngine,
} from "./stockfish-client";

export interface UseStockfish {
  /** Run one search. Rejects with {@link EngineUnavailableError} when disabled/broken. */
  search(request: SearchRequest): Promise<SearchResult>;
  /** Ask a running search to finish now. */
  stop(): void;
  /** Re-run the UCI handshake after a failed load (the retry button). */
  retry(): void;
  /** Live engine handle, or null when the hook is disabled. */
  engineRef: React.RefObject<StockfishEngine | null>;
}

/**
 * @param enabled true only for `game.mode === "ai"` — never boot the engine for
 *                online, local or spectated games.
 */
export function useStockfish(enabled: boolean): UseStockfish {
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const engine = acquireEngine();
    engineRef.current = engine;

    const publish = (status: EngineStatus) => {
      useAiStore.getState().setEngineStatus(status);
    };
    publish(engine.getStatus());
    const unsubscribe = engine.onStatus(publish);
    // Warm the wasm as soon as the AI game mounts so the first move does not pay
    // for the ~1 s cold load. Failures surface through the status subscription.
    void engine.init().catch(() => undefined);

    return () => {
      unsubscribe();
      engineRef.current = null;
      releaseEngine();
      useAiStore.getState().setEngineStatus("idle");
    };
  }, [enabled]);

  const search = useCallback(async (request: SearchRequest): Promise<SearchResult> => {
    const engine = engineRef.current;
    if (engine === null) throw new EngineUnavailableError("engine-not-mounted");
    return await engine.search(request);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const retry = useCallback(() => {
    const engine = engineRef.current;
    if (engine === null) return;
    void engine.init().catch(() => undefined);
  }, []);

  return { search, stop, retry, engineRef };
}
