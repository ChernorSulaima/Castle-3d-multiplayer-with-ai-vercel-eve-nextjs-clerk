// src/lib/engine/stockfish-client.ts
//
// Browser-only wrapper around stockfish@11.0.0 running in a CLASSIC worker loaded by
// URL string from /public (constants.STOCKFISH_WORKER_URL = "/stockfish/sf11/stockfish.js").
//
// Never `new Worker(new URL(...))`: under Turbopack that appends a `#params=[...]`
// fragment, and this glue treats `self.location.hash` as the override path for the
// sibling `.wasm` (stockfish.md §11.3 + nextjs16-shadcn.md §4b). The `.wasm` is resolved
// automatically as the sibling of the `.js`, so nothing else needs configuring.
//
// SF11 facts this file depends on (all verified in stockfish.md §11.2):
//   * every output line arrives as a plain string in `e.data`
//   * options are `MultiPV` 1..500 and `Skill Level` 0..20 — there is NO UCI_Elo
//   * `Threads`/`Hash` are pinned (min == max), so we never send them
//   * the glue does no command queueing, so searches MUST be serialised here
//   * `stop` produces `bestmove` ~180 ms later
import { STOCKFISH_WORKER_URL } from "@/lib/constants";
import type { EngineStatus } from "@/lib/types";
import { PvCollector, isBestMove, isReadyOk, isUciOk, parseBestMove, type PvLine } from "./parse-uci";

/** Handshake budget. Cold load of the 669 KB gzipped engine measured at ~108 ms. */
export const ENGINE_INIT_TIMEOUT_MS = 20_000;
const READY_TIMEOUT_MS = 10_000;
/** `stop` -> `bestmove` was measured at ~180 ms; 4 s is a generous ceiling. */
const BESTMOVE_GRACE_MS = 4_000;
/** How long a released engine lingers before `terminate()` (StrictMode remount). */
export const ENGINE_DISPOSE_DELAY_MS = 400;

export interface SearchRequest {
  fen: string;
  /** UCI `go depth`. */
  depth: number;
  /** UCI `MultiPV` (1..500). */
  multiPv: number;
  /** UCI `Skill Level` (0..20). Pass 20 for honest candidate ranking. */
  skillLevel?: number;
  /** Client-side hard `stop` timer. */
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface SearchResult {
  /** UCI long algebraic, or null for `bestmove (none)` (mate/stalemate). */
  bestmove: string | null;
  ponder: string | null;
  lines: PvLine[];
  elapsedMs: number;
  /** True when the client-side timer (or an abort) cut the search short. */
  stopped: boolean;
}

export class EngineUnavailableError extends Error {
  constructor(message = "engine-unavailable") {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

type LineListener = (line: string) => void;
type StatusListener = (status: EngineStatus) => void;
interface Pending {
  fail(error: Error): void;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly lineListeners = new Set<LineListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly pending = new Set<Pending>();
  private currentStatus: EngineStatus = "idle";
  private disposed = false;
  private appliedMultiPv: number | null = null;
  private appliedSkillLevel: number | null = null;

  constructor(readonly url: string = STOCKFISH_WORKER_URL) {}

  getStatus(): EngineStatus {
    return this.currentStatus;
  }

  /** Subscribe to status transitions. Returns the unsubscribe function. */
  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Boot the worker and complete the UCI handshake. Idempotent; concurrent callers
   * share one promise. A failed init clears the promise so `init()` retries cleanly.
   */
  init(): Promise<void> {
    if (this.disposed) return Promise.reject(new EngineUnavailableError("engine-disposed"));
    if (this.readyPromise !== null) return this.readyPromise;
    if (typeof Worker === "undefined") {
      this.setStatus("error");
      return Promise.reject(new EngineUnavailableError("worker-unsupported"));
    }

    this.setStatus("loading");
    const promise = (async () => {
      const worker = new Worker(this.url);
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const line = String(event.data);
        for (const listener of [...this.lineListeners]) listener(line);
      };
      worker.onerror = () => {
        this.failAll(new EngineUnavailableError("worker-error"));
      };
      try {
        await this.expect(isUciOk, () => this.send("uci"), ENGINE_INIT_TIMEOUT_MS);
        await this.expect(isReadyOk, () => this.send("isready"), READY_TIMEOUT_MS);
        this.send("ucinewgame");
        await this.expect(isReadyOk, () => this.send("isready"), READY_TIMEOUT_MS);
        this.appliedMultiPv = null;
        this.appliedSkillLevel = null;
        this.setStatus("ready");
      } catch (error) {
        this.teardownWorker();
        this.readyPromise = null;
        this.setStatus("error");
        throw error instanceof Error ? error : new EngineUnavailableError();
      }
    })();
    this.readyPromise = promise;
    return promise;
  }

  /** `ucinewgame` + `isready`. Clears the transposition table between games. */
  async newGame(): Promise<void> {
    await this.init();
    await this.enqueue(async () => {
      this.send("ucinewgame");
      await this.expect(isReadyOk, () => this.send("isready"), READY_TIMEOUT_MS);
      this.appliedMultiPv = null;
      this.appliedSkillLevel = null;
    });
  }

  /**
   * One search at a time. Sends `setoption` (only when the value changed),
   * `position fen`, then `go depth N` with a client-side `stop` timer.
   */
  search(request: SearchRequest): Promise<SearchResult> {
    return this.enqueue(() => this.runSearch(request));
  }

  /** Ask a running search to finish now; `bestmove` follows within ~200 ms. */
  stop(): void {
    if (this.worker !== null) this.send("stop");
  }

  /** Terminate the worker (NFR-3: never leave the engine resident after unmount). */
  dispose(): void {
    this.disposed = true;
    this.failAll(new EngineUnavailableError("engine-disposed"));
    this.teardownWorker();
    this.readyPromise = null;
    this.lineListeners.clear();
    this.setStatus("idle");
    this.statusListeners.clear();
  }

  /* --------------------------------------------------------------- internals */

  private async runSearch(request: SearchRequest): Promise<SearchResult> {
    await this.init();
    throwIfAborted(request.signal);

    const multiPv = clamp(Math.trunc(request.multiPv), 1, 500);
    const skillLevel = clamp(Math.trunc(request.skillLevel ?? 20), 0, 20);
    let optionsChanged = false;
    if (this.appliedMultiPv !== multiPv) {
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.appliedMultiPv = multiPv;
      optionsChanged = true;
    }
    if (this.appliedSkillLevel !== skillLevel) {
      this.send(`setoption name Skill Level value ${skillLevel}`);
      this.appliedSkillLevel = skillLevel;
      optionsChanged = true;
    }
    if (optionsChanged) {
      await this.expect(isReadyOk, () => this.send("isready"), READY_TIMEOUT_MS);
    }

    const collector = new PvCollector();
    const collect: LineListener = (line) => {
      collector.accept(line);
    };
    this.lineListeners.add(collect);

    let stopped = false;
    const startedAt = Date.now();
    const requestStop = () => {
      if (stopped) return;
      stopped = true;
      this.send("stop");
    };
    const stopTimer = setTimeout(requestStop, Math.max(50, request.timeoutMs));
    request.signal?.addEventListener("abort", requestStop, { once: true });

    try {
      this.send(`position fen ${request.fen}`);
      const line = await this.expect(
        isBestMove,
        () => this.send(`go depth ${Math.max(1, Math.trunc(request.depth))}`),
        Math.max(50, request.timeoutMs) + BESTMOVE_GRACE_MS,
      );
      const parsed = parseBestMove(line);
      return {
        bestmove: parsed?.bestmove ?? null,
        ponder: parsed?.ponder ?? null,
        lines: collector.lines(),
        elapsedMs: Date.now() - startedAt,
        stopped,
      };
    } finally {
      clearTimeout(stopTimer);
      request.signal?.removeEventListener("abort", requestStop);
      this.lineListeners.delete(collect);
    }
  }

  /** Serialises every command sequence; the SF11 glue does no queueing of its own. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private send(command: string): void {
    this.worker?.postMessage(command);
  }

  private expect(
    match: (line: string) => boolean,
    run: () => void,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const entry: Pending = {
        fail: (error) => {
          finish();
          reject(error);
        },
      };
      const listener: LineListener = (line) => {
        if (!match(line)) return;
        finish();
        resolve(line);
      };
      const timer = setTimeout(() => {
        entry.fail(new EngineUnavailableError(`stockfish-timeout:${timeoutMs}ms`));
      }, timeoutMs);
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.lineListeners.delete(listener);
        this.pending.delete(entry);
      };

      this.lineListeners.add(listener);
      this.pending.add(entry);
      try {
        run();
      } catch (error) {
        entry.fail(error instanceof Error ? error : new EngineUnavailableError());
      }
    });
  }

  private failAll(error: Error): void {
    for (const entry of [...this.pending]) entry.fail(error);
    if (!this.disposed) this.setStatus("error");
  }

  private teardownWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.appliedMultiPv = null;
    this.appliedSkillLevel = null;
    if (worker === null) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }

  private setStatus(status: EngineStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }
}

/* ------------------------------------------------- refcounted shared instance */
// One worker for the whole app: creating a second costs another 64 MB of wasm
// memory for no benefit (only one search can run at a time anyway). Release is
// deferred by ENGINE_DISPOSE_DELAY_MS so React StrictMode's mount/unmount/mount
// and a fast route change reuse the same booted engine instead of paying for a
// second cold start.

let sharedEngine: StockfishEngine | null = null;
let refCount = 0;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;

export function acquireEngine(): StockfishEngine {
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }
  sharedEngine ??= new StockfishEngine();
  refCount += 1;
  return sharedEngine;
}

export function releaseEngine(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || disposeTimer !== null) return;
  disposeTimer = setTimeout(() => {
    disposeTimer = null;
    if (refCount > 0) return;
    sharedEngine?.dispose();
    sharedEngine = null;
  }, ENGINE_DISPOSE_DELAY_MS);
}

/** Test/debug helper: the live shared engine, if any. */
export function peekSharedEngine(): StockfishEngine | null {
  return sharedEngine;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new EngineUnavailableError("aborted");
}
