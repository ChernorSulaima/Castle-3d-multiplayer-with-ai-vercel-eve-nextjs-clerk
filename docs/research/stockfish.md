# stockfish 18.0.8 (npm) — research notes for the 3D chess project

Scope: running Stockfish in a browser Web Worker from Next.js 16 (App Router, Turbopack), and secondarily in Node for an Eve tool.
Everything below was verified against the installed package at
`node_modules/stockfish` (v18.0.8), by executing the engine in Node 24.14.1 and in a real browser (classic Worker served from a plain static server with **no** COOP/COEP headers), and by reading Stockfish 18 upstream source (`sf_18` tag). Sources are cited per section.

---

## 1. Package facts

| Item | Value | Source |
|---|---|---|
| Package | `stockfish@18.0.8`, `buildVersion: "18"` (Stockfish 18 engine) | `package.json` |
| Author / sponsor | Nathan Rugg (nmrugg/stockfish.js), Chess.com | `package.json`, README |
| License | **GPL-3.0** (`Copying.txt` is the GPLv3 text; README: "Stockfish.js (c) 2026, Chess.com, LLC, GPLv3"). The tiny Node glue files (`index.js`, `scripts/*.js`) carry `/// License: MIT` headers, but the engine `.js`/`.wasm` are GPLv3. Shipping the worker in a web app = distributing GPL code: keep the license header in the copied `.js` (it is in the file banner), and keep `Copying.txt` alongside in `public/stockfish/`. | `Copying.txt`, `README.md`, file banners |
| `main` | `index.js` — a **Node-only** loader (uses `require("fs")`). Do not import `stockfish` from client code. | `index.js` |
| `bin` (CLI) | `scripts/cli.js` → runs `bin/stockfish.js` as a UCI REPL on stdin/stdout | `scripts/cli.js` |
| Published files | `bin/` only (+ `scripts/postinstall.js`). There is **no `src/`** in the npm tarball. | `package.json#files`, `ls` |
| postinstall | creates symlinks `bin/stockfish.js -> stockfish-18.js` and `bin/stockfish.wasm -> stockfish-18.wasm` (the **full multi-threaded** build) | `scripts/postinstall.js` |
| Dependencies | none | `package.json` |

## 2. Shipped build variants (measured)

`ls -la` + `gzip -9 -c f | wc -c` on `node_modules/stockfish/bin/`:

| Variant | Files | Raw | gzip -9 | Threads | Needs SharedArrayBuffer / COOP+COEP? | Notes |
|---|---|---|---|---|---|---|
| Full, multi-threaded | `stockfish-18.js` + `stockfish-18.wasm` | 32.8 KB + **113.0 MB** | 12.1 KB + **75.8 MB** | yes (`Threads` option, pthread pool = `navigator.hardwareConcurrency`) | **YES** — wasm *imports* a `shared: true` memory; JS throws `"bad memory"` if `SharedArrayBuffer` is unavailable | Strongest. Spawns pthread workers by re-loading the same `.js` URL with `#<wasm>,worker` hash. |
| Full, single-threaded | `stockfish-18-single.js` + `stockfish-18-single.wasm` | 21.3 KB + 113.0 MB | 8.2 KB + 76.5 MB | no (`Threads` max 1) | No (non-shared memory, ASYNCIFY build) | Nets: `EvalFile nn-c288c895ea92.nnue` + `EvalFileSmall nn-37f18f62d772.nnue` (verified via `uci`). |
| Lite, multi-threaded | `stockfish-18-lite.js` + `stockfish-18-lite.wasm` | 32.9 KB + 7.09 MB | 12.1 KB + **5.59 MB** | yes | **YES** (shared memory import) | Small net only. |
| **Lite, single-threaded** | `stockfish-18-lite-single.js` + `stockfish-18-lite-single.wasm` | 21.4 KB + 7.30 MB | 8.3 KB + **5.64 MB** | no | **No** — wasm *defines* its own non-shared memory (`flags=1, shared=false, min=2048 pages, max=32768 pages`) | README's recommended default. Net: `nn-9067e33176e8.nnue` (11 MiB uncompressed in-memory, embedded). |
| asm.js fallback | `stockfish-18-asm.js` (no wasm) | 10.5 MB | 6.59 MB | no | No | "Very slow and weak … last resort" (README). Larger gzipped than lite wasm — not worth shipping. |

Verification of the SAB requirement: parsed the wasm import/memory sections with a small Node script — `stockfish-18-lite.wasm` has `memImport {mod:"a", fld:"a", shared:true}`, `stockfish-18-lite-single.wasm` has `memDef {shared:false}`. `stockfish-18-lite.js` contains `new WebAssembly.Memory({initial:…, maximum:32768, shared:!0})` and throws `Error("bad memory")` when the buffer is not a `SharedArrayBuffer`; `stockfish-18-lite-single.js` contains no `SharedArrayBuffer` reference at all. In the browser test page `crossOriginIsolated === false` and `typeof SharedArrayBuffer === "undefined"`, and the lite-single worker still searched to depth 10 in ~350 ms.

Compile flags (upstream `src/emscripten/wasm-makefile.mk`, fetched from GitHub master — matches the observed exports): all wasm flavours use `-msimd128` (**WASM SIMD required**; asm.js build excluded); single-threaded flavours add `-s ASYNCIFY=1 -s ASYNCIFY_STACK_SIZE=10485760 -s USE_PTHREADS=0`; multi-threaded use `-s USE_PTHREADS=1 -s PROXY_TO_PTHREAD`; all use `-s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=134217728 -s MAXIMUM_MEMORY=2147483648`, `-s MODULARIZE=1 -s EXPORT_NAME="Stockfish"`, `-s ENVIRONMENT=web,worker,node`, `EXPORTED_FUNCTIONS=['_main','_command','_isSearching']` (+`_isReady` on MT), `EXPORTED_RUNTIME_METHODS=ccall`.

Consequences:
- **Each engine instance reserves 128 MB of WASM memory up-front** (2048 × 64 KiB pages), growable to 2 GB. Create one worker per page, lazily, and `terminate()` it when leaving AI mode.
- Browser support = WASM SIMD: README says Chrome/Edge/Firefox/Opera/Safari on Windows 10+/macOS 11+/iOS 16+/Linux/Android (exact Safari minor not verified — see §10).

### 2.1 The <2 MB gzipped budget (NFR-3) is NOT achievable with this package

The smallest WASM this package ships is **5.64 MB gzipped** (lite-single). Nothing in the tarball is under 2 MB. Options, in order of preference:

1. **Ship lite-single (~5.65 MB gz incl. JS), lazy-loaded only in AI mode, with a download progress bar** (the wrapper has a built-in progress channel, §4.3) and long-lived immutable caching (§3.3). Raise NFR-3 to "≤ 6 MB gzipped, lazy, cached". This is what the README recommends and what Chess.com ships.
2. Build an `ULTRA_LITE_NET=yes` flavour yourself — upstream `build.js` has that switch, but **no ultra-lite artifact is published in the npm package** and building needs emscripten 3.1.7 (README). Size unknown (§10).
3. Use a different engine package with a smaller net — out of scope here.

The engine also needs the (non-cacheable-by-us) 128 MB memory reservation regardless of net size.

## 3. Serving the lite-single build from Next.js

### 3.1 Copy the files

```bash
mkdir -p public/stockfish
cp node_modules/stockfish/bin/stockfish-18-lite-single.js  public/stockfish/
cp node_modules/stockfish/bin/stockfish-18-lite-single.wasm public/stockfish/
cp node_modules/stockfish/Copying.txt public/stockfish/LICENSE-GPL-3.0.txt   # license compliance
```

Add a `postinstall`/`prebuild` script (`scripts/copy-stockfish.mjs`) that does the copy so the 7 MB binary does not have to be committed (or commit it — it is versioned by filename). Filenames must keep the `stockfish-18-lite-single` basename (see 3.2).

### 3.2 How the `.js` finds its `.wasm` (verified from the minified source of `stockfish-18-lite-single.js`)

When the script runs inside a Web Worker it executes this glue (de-minified):

```js
// worker branch: `typeof onmessage !== "undefined" && (typeof window === "undefined" || window.document === undefined)`
e = self.location.hash.substr(1).split(",");
u = decodeURIComponent(e[0] || location.origin + location.pathname.replace(/\.js$/i, ".wasm"));
c = {
  locateFile: (p) => p.indexOf(".wasm") > -1
      ? (p.indexOf(".wasm.map") > -1 ? u + ".map" : u)
      : self.location.origin + self.location.pathname + "#" + u + ",worker",
  listener: (line) => postMessage(line),
  instantiateWasm: (imports, done) => fetchWithProgress(u).then(r => WebAssembly.instantiateStreaming(r, imports)) …
};
onmessage = onmessage || function (e) { /* see §4 */ };
```

So:
- **Default**: the wasm URL is the worker script URL with `.js` → `.wasm`, same directory. `new Worker("/stockfish/stockfish-18-lite-single.js")` fetches `/stockfish/stockfish-18-lite-single.wasm`. No `locateFile` config is needed or possible from outside.
- **Override**: pass the wasm URL in the hash: `new Worker("/stockfish/stockfish-18-lite-single.js#" + encodeURIComponent("https://cdn.example.com/sf/stockfish-18-lite-single.wasm"))` (first comma-separated hash field; it is `decodeURIComponent`-ed). Cross-origin wasm then needs CORS on the CDN.
- The wasm is fetched with `fetch(url)` and `WebAssembly.instantiateStreaming(response)`; the custom `instantiateWasm` has **no ArrayBuffer fallback** (`catch(e){console.error("WASM streaming failed:",e);throw e}`), so the server **must send `Content-Type: application/wasm`**. Python's static server did (and Next/Vercel use standard mime tables — see §10 to confirm on first run). Do not put the wasm behind a route that rewrites content-type.
- It must be a **classic same-origin Worker** loaded by URL string. Do **not** use `new Worker(new URL("./x.js", import.meta.url))` (Turbopack/webpack would try to bundle a 21 KB UMD file that uses `self.location`, `importScripts` detection and `require` probes) and do not `import` it. Keep it in `/public`.
- `self.location.hash` must not carry `,worker` as its 2nd field — that is the internal marker for pthread sub-workers of the MT build; with it the script does nothing.

### 3.3 next.config.ts additions

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        // filenames are version-stamped (stockfish-18-…), safe to cache forever
        source: "/stockfish/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};
export default nextConfig;
```

`headers` is a valid `NextConfig` key in 16.3.4 (`node_modules/next/dist/server/config-shared.d.ts:1238`). **Do not add COOP/COEP** — not needed for lite-single, and `Cross-Origin-Embedder-Policy: require-corp` would break Clerk/Convex/HDRI cross-origin loads.

## 4. Worker message API (verified from source + live browser run)

- **Input**: `worker.postMessage("<uci command string>")`. One command per message. Whitespace is trimmed.
- **Output**: every engine stdout/stderr line arrives as `worker.onmessage = (e) => e.data` where `e.data` is a **plain string** (`listener: (line) => postMessage(line)`; `Module.print`/`printErr` both route to `listener`).
- First line emitted (before you send anything): `Stockfish 18 Lite WASM by the Stockfish developers (see AUTHORS file)`.
- **No custom handshake**: standard UCI. Commands posted before the wasm has finished instantiating are buffered in an array and replayed in order once ready, so you can `postMessage("uci")` immediately after `new Worker(...)`.
- **Internal queueing** (function `i`/`a` in the glue): commands starting with `go` or `setoption` are queued and only forwarded when `Module._isSearching()` is false (flushed via `onDoneSearching`). All other commands (`stop`, `isready`, `position`, `ucinewgame`, `uci`, `quit`) are forwarded immediately via `ccall("command", null, ["string"], [cmd], {async: /^go\b/})`. Practical rule: **never send `position`/`go` for a new request while a search is running — send `stop`, await `bestmove`, then continue.**
- `postMessage("quit")` → the glue calls `self.close()` (worker ends). Prefer `worker.terminate()` from the main thread (upstream `examples/loadEngine.js` does this).
- Special messages:
  - `postMessage("setoption name CanOutputEngineDownloadProgress")` → engine replies `"info WillOutputEngineDownloadProgress"` (capability probe).
  - `postMessage({ progressPort: port2 }, [port2])` with a `MessageChannel` → `port1.onmessage` receives download-progress objects `{percent, loaded, total, speedBytesPerSec, speedText, eta, etaText}` (throttled ~4 ms; port auto-closes at 100 %). Verified in browser: `{"percent":1,"loaded":7295411,"total":7295411,…}`.
- Errors: `worker.onerror` for load failures (e.g. wrong MIME → `"WASM streaming failed:"` in console then rethrow).

### 4.1 Observed startup timings
Node (files on disk): lite-single ready in ~90 ms, full-single ~250 ms. Browser (localhost, cached): `uci`→`uciok`+`go depth 10` MultiPV 2 finished 353 ms after worker creation. Cold download of 5.6 MB dominates on first visit.

## 5. UCI protocol sequence to implement (all outputs below are verbatim from the lite-single engine)

```
> uci
< id name Stockfish 18 Lite WASM
< id author the Stockfish developers (see AUTHORS file)
< option name Threads type spin default 1 min 1 max 1
< option name Hash type spin default 16 min 1 max 33554432
< option name Clear Hash type button
< option name Ponder type check default false
< option name MultiPV type spin default 1 min 1 max 256
< option name Skill Level type spin default 20 min 0 max 20
< option name Move Overhead type spin default 10 min 0 max 5000
< option name nodestime type spin default 0 min 0 max 10000
< option name UCI_Chess960 type check default false
< option name UCI_LimitStrength type check default false
< option name UCI_Elo type spin default 1320 min 1320 max 3190
< option name UCI_ShowWDL type check default false
< option name EvalFile type string default nn-9067e33176e8.nnue
< option name EvalFileSmall type string default <empty>
< uciok
> isready
< readyok
> ucinewgame                      // call at the start of every new game (clears hash/history)
> setoption name MultiPV value 3   // 1..256
> setoption name Skill Level value 5   // 0..20 (20 = full strength)
> isready                         // re-sync after setoptions
< readyok
> position startpos moves e2e4 e7e5
      // or: position fen <FEN> [moves <uci> ...]  (moves are long algebraic: e2e4, e7e8q)
> go depth 8                      // or: go movetime 1500 | go nodes N | go infinite (+ stop) | go wtime W btime B winc I binc I
< info string NNUE evaluation using nn-9067e33176e8.nnue (11MiB, (22528, 256, 15, 32, 1))
< info string Network replica 1: Local memory. Shared memory not supported by the OS. Local allocation fallback.
< info depth 8 seldepth 12 multipv 1 score cp 43 nodes 21336 nps 1066800 hashfull 4 time 20 pv g1f3 d7d5 f3e5 ...
< info depth 8 seldepth 14 multipv 2 score cp 34 nodes 21336 nps 1066800 hashfull 4 time 20 pv d2d4 d7d5 ...
< info depth 8 seldepth 11 multipv 3 score cp 18 nodes 21336 nps 1066800 hashfull 4 time 20 pv f1c4 b8c6 ...
< bestmove b1c3 ponder b8c6
> stop                            // during a `go movetime 5000`, bestmove arrived 51 ms later (verified)
< bestmove d2d4 ponder e5d4
```

Parsing notes (verified against captured output):
- `info` lines to parse have the shape `info depth D seldepth S multipv M score (cp X | mate Y) [lowerbound|upperbound] nodes N nps P hashfull H time T pv m1 m2 …`. When `MultiPV` is 1 the `multipv 1` token is still present.
- Skip lines containing ` lowerbound` / ` upperbound` (fail-high/low partial results; a `score cp 34 upperbound … pv d2d4 e5d4` line was observed) and `info string …` lines.
- `score cp` is centipawns **from the side to move's perspective** (after `position startpos moves e2e4`, Black to move, all lines were negative: `cp -10 … -42`). Negate for a White-relative eval when Black is to move. `score mate N`: N>0 side-to-move mates in N moves, N<0 gets mated.
- `bestmove <uci> [ponder <uci>]`; `bestmove (none)` when no legal move (mate/stalemate) — guard with chess.js before calling the engine anyway.
- Only the **last** `info … multipv M` line per M (highest depth) matters; keep a `Map<multipv, line>` and overwrite.
- `mate` and `cp` never appear together; `wdl` appears only with `setoption name UCI_ShowWDL value true` (not needed).
- Sending `setoption` between games is fine; `setoption name Clear Hash value true` exists if needed.

## 6. Skill Level / UCI_Elo semantics (Stockfish 18 source, `src/search.h` + `src/search.cpp` at tag `sf_18`)

```cpp
struct Skill {
    constexpr static int LowestElo  = 1320;
    constexpr static int HighestElo = 3190;
    Skill(int skill_level, int uci_elo) {
        if (uci_elo) { double e = double(uci_elo - LowestElo) / (HighestElo - LowestElo);
                       level = std::clamp((((37.2473*e - 40.8525)*e + 22.2943)*e - 0.311438), 0.0, 19.0); }
        else level = double(skill_level);
    }
    bool enabled() const { return level < 20.0; }
    bool time_to_pick(Depth depth) const { return depth == 1 + int(level); }
    …
};
// search.cpp: Skill(options["Skill Level"], options["UCI_LimitStrength"] ? int(options["UCI_Elo"]) : 0);
// search.cpp:307  if (skill.enabled()) multiPV = std::max(multiPV, size_t(4));
// search.cpp:474  if (skill.enabled() && skill.time_to_pick(rootDepth)) skill.pick_best(rootMoves, multiPV);
// search.cpp:540  if (skill.enabled()) std::swap(rootMoves[0], *find(... skill.best ? skill.best : skill.pick_best(...)));
```

Implications for the difficulty table (Beginner 1/2, Casual 5/6, Intermediate 10/10, Advanced 15/14, Grandmaster 20/18):
- `Skill Level 20` = full strength. Any value < 20 turns on handicap mode: the engine **internally searches with MultiPV ≥ 4** and, at iteration depth `1 + level` (or at the end of the search if that depth was never reached), **picks a randomised sub-optimal move** (`pick_best`, PRNG seeded with `now()` → non-deterministic). `weakness = 120 - 2*level`.
- **`bestmove` can therefore differ from `multipv 1`'s first pv move** when Skill Level < 20. The `info … multipv` lines still report the true ranking. For Eve's `analysePosition` (needs honest top-N candidates), run with `Skill Level 20` and `MultiPV N` and apply the selection policy in JS. Use `Skill Level` only when you want Stockfish itself to play the weakened move (e.g. the 10-second fallback move).
- `UCI_LimitStrength true` + `UCI_Elo` (1320..3190) **overrides** `Skill Level` (mapped to a fractional level 0..19). Either mechanism, not both. The requirements use Skill Level; keep it.
- Depth interacts: with Beginner `Skill Level 1` and `go depth 2`, `time_to_pick` fires at depth 2 — fine. With `go depth 18` and `Skill Level 15` it fires at depth 16.
- Because of the forced MultiPV ≥ 4 and the ASYNCIFY single thread, keep an eye on FR-38 (< 3 s): depth 18 at Grandmaster on a phone may exceed it — prefer `go depth 18` **with a client-side timeout that sends `stop`** (bestmove then arrives within ~50 ms) or `go movetime 2500`.

## 7. Minimal TypeScript wrapper (browser) — verified API surface only

```ts
// src/lib/engine/stockfish-client.ts  ('use client' consumers only; never import on the server)
export type PvLine = { multipv: number; depth: number; scoreCp?: number; scoreMate?: number; pv: string[] };
export type SearchResult = { bestmove: string; ponder?: string; lines: PvLine[] };

const INFO_RE = /^info depth (\d+) seldepth \d+ multipv (\d+) score (cp|mate) (-?\d+)( lowerbound| upperbound)? .*? pv (.+)$/;

export class StockfishClient {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve(); // serialise searches
  private lineHandlers = new Set<(l: string) => void>();

  constructor(private url = "/stockfish/stockfish-18-lite-single.js") {}

  /** Lazily start the worker and complete `uci` -> `uciok`, `isready` -> `readyok`. */
  init(onProgress?: (p: { percent: number; loaded: number; total: number }) => void): Promise<void> {
    if (this.ready) return this.ready;
    const w = new Worker(this.url);           // classic worker, same origin, .wasm resolved as sibling
    this.worker = w;
    w.onmessage = (e: MessageEvent<string>) => { for (const h of this.lineHandlers) h(String(e.data)); };
    if (onProgress) {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => onProgress(e.data);
      w.postMessage({ progressPort: ch.port2 }, [ch.port2]);
    }
    this.ready = (async () => {
      await this.expect("uciok", () => this.send("uci"));
      await this.expect("readyok", () => this.send("isready"));
    })();
    return this.ready;
  }

  send(cmd: string) { this.worker!.postMessage(cmd); }

  private expect(token: string, run: () => void, timeoutMs = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { off(); reject(new Error(`stockfish: timeout waiting for ${token}`)); }, timeoutMs);
      const h = (l: string) => { if (l === token || l.startsWith(token + " ")) { clearTimeout(t); off(); resolve(l); } };
      const off = () => this.lineHandlers.delete(h);
      this.lineHandlers.add(h); run();
    });
  }

  async newGame(opts: { skillLevel: number; multiPv: number }) {
    await this.init();
    this.send("ucinewgame");
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, opts.skillLevel))}`);
    this.send(`setoption name MultiPV value ${Math.max(1, Math.min(256, opts.multiPv))}`);
    await this.expect("readyok", () => this.send("isready"));
  }

  /** One search at a time; `position fen …` then `go depth N`, resolved on `bestmove`. */
  search(fen: string, go: { depth?: number; movetime?: number }, hardTimeoutMs = 3000): Promise<SearchResult> {
    const run = async () => {
      await this.init();
      const lines = new Map<number, PvLine>();
      const collect = (l: string) => {
        const m = INFO_RE.exec(l);
        if (!m || m[5]) return;                 // skip bound lines
        const line: PvLine = { depth: +m[1], multipv: +m[2], pv: m[6].split(" ") };
        if (m[3] === "cp") line.scoreCp = +m[4]; else line.scoreMate = +m[4];
        lines.set(line.multipv, line);
      };
      this.lineHandlers.add(collect);
      const stopTimer = setTimeout(() => this.send("stop"), hardTimeoutMs); // FR-38 guard
      try {
        this.send(`position fen ${fen}`);
        const bm = await this.expect("bestmove", () =>
          this.send(go.movetime ? `go movetime ${go.movetime}` : `go depth ${go.depth ?? 10}`), hardTimeoutMs + 5000);
        const [, bestmove, , ponder] = bm.split(" ");
        return { bestmove, ponder, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) };
      } finally { clearTimeout(stopTimer); this.lineHandlers.delete(collect); }
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  stop() { this.send("stop"); }
  dispose() { this.worker?.terminate(); this.worker = null; this.ready = null; }
}
```

Notes: `bestmove` is UCI long algebraic (`e7e8q` for promotions) — convert with `chess.js` `move({from, to, promotion})` to SAN. Scores are side-to-move relative (§5). Wrap in a `useEffect`/zustand store so the worker is created once per AI game and `dispose()`d on unmount.

### 7.1 Difficulty mapping (from requirements §3.8, mapped onto verified option ranges)

| Level | `setoption name Skill Level` | `go depth` | Suggested `MultiPV` for Eve candidates |
|---|---|---|---|
| Beginner | 1 | 2 | 5 |
| Casual | 5 | 6 | 3 |
| Intermediate | 10 | 10 | 2 |
| Advanced | 15 | 14 | 1 |
| Grandmaster | 20 | 18 | 1 |

Per §6, for the candidate list sent to Eve use `Skill Level 20` + `MultiPV N`; use the row's Skill Level only for the raw-Stockfish fallback move.

## 8. Running in Node (server-side Eve tool) — verified

### 8.1 Official loader (`require("stockfish")`)
```js
const initEngine = require("stockfish");          // index.js, CommonJS, Node only
const engine = await initEngine("lite-single");   // keywords: "full" | "lite" | "single" | "lite-single" | "asm" | <absolute/relative path to a .js>; default = bin/stockfish.js (FULL MT build!)
engine.listener = (line) => { /* every output line, string */ };
engine.sendCommand("uci");                        // schedules ccall("command") via setImmediate; `go …` is ccall'd async
```
Verified sequence in Node 24.14.1: `uci`→`uciok`, `isready`→`readyok`, `setoption`, `position`, `go depth 8` (MultiPV 3) → `bestmove` in 20 ms; `go movetime 5000` + `stop` after 400 ms → `bestmove` in 451 ms; `UCI_LimitStrength`/`UCI_Elo 1320` accepted. `initEngine(path, cb)` callback form also exists. `engine` is the raw Emscripten `Module` (has `ccall`, `terminate`, etc.).

Caveats:
- `engine.sendCommand` does **no** go/setoption queueing (unlike the worker glue) — serialise searches yourself (await `bestmove` before the next `position`/`go`).
- Without a keyword, `initEngine()` loads the **full multi-threaded** build (113 MB wasm, `readFileSync` into memory, needs SAB/worker_threads). Always pass `"lite-single"` (or `"single"`).
- `index.js` also concatenates `*-part-*.wasm` chunks if present (not applicable to 18.0.8).
- **Cannot be used inside a Node `worker_threads` Worker**: the engine `.js` glue checks `!require("worker_threads").isMainThread` and then skips *all* setup, leaving `module.exports = {}` — `index.js` then throws `"Could not load the engine correctly."`. Verified by running a `worker_threads` test (`typeof module.exports === "object", keys: []`). Use the main thread, or spawn a **child process** running the CLI:
  `spawn(process.execPath, [require.resolve("stockfish/bin/stockfish-18-lite-single.js")])` — when the file is the entry module (`require.main === module`) it becomes a stdin/stdout UCI REPL (readline; `quit` exits). `npx stockfish` does the same for the full build.
- Each instance reserves 128 MB wasm memory; single-threaded; a search is CPU-bound on the event loop thread (ASYNCIFY yields, but expect the function to be busy). On a Vercel Node function this fits the memory default but adds ~100 ms cold init + module load.
- Bundling on Vercel/Next: `index.js` `require()`s the engine path dynamically, so Next's tracer will not pick the binaries up automatically. Add to `next.config.ts`:
  ```ts
  serverExternalPackages: ["stockfish"],
  outputFileTracingIncludes: { "/api/**": ["./node_modules/stockfish/bin/stockfish-18-lite-single.{js,wasm}"] },
  outputFileTracingExcludes: { "*": ["./node_modules/stockfish/bin/stockfish-18.wasm", "./node_modules/stockfish/bin/stockfish-18-single.wasm", "./node_modules/stockfish/bin/stockfish-18-asm.js", "./node_modules/stockfish/bin/stockfish.wasm"] },
  ```
  (keys verified in `config-shared.d.ts` lines 1588/1598/1603; adjust the route glob to the actual Eve route.) The 113 MB full builds must be excluded or the function bundle balloons (and the postinstall `stockfish.wasm` symlink points at the full build).
- Recommendation (matches FR-35 note and risk register): **compute candidates in the browser worker and pass them to Eve as tool input/context**; keep the Node engine only as an optional fallback. It avoids the tracing/size work, the 128 MB per-invocation memory, and duplicate NNUE downloads.

## 9. Gotchas checklist

1. `Threads` is `min 1 max 1` on single-threaded builds; don't send `setoption name Threads` (harmless, but pointless).
2. `Hash` default 16 MB; raising it increases the already-large memory footprint. Leave at 16.
3. Skill Level < 20 forces internal MultiPV ≥ 4 and randomises `bestmove` (§6). Skill Level 0 is the weakest legal value; requirements start at 1.
4. Send `ucinewgame` + `isready` at game start (verified accepted; clears TT so evals do not leak between games).
5. Do not reuse one worker for concurrent searches; queue them (wrapper above) or create a second worker (costs another 128 MB).
6. `quit` closes the worker (`self.close()`); after that `postMessage` is silently dropped — use `terminate()` + re-`init()`.
7. Postmessage payloads must be strings except the two special objects (`{progressPort}`); anything else is passed to `processCommand` and fails.
8. Load only in the AI-mode client component (`"use client"`), guarded by `typeof Worker !== "undefined"`; SSR must not touch it.
9. If the app is ever cross-origin-isolated later (COOP/COEP), the lite-single build keeps working; only then consider `stockfish-18-lite.js` for `Threads`.
10. The full builds' `EvalFile`/`EvalFileSmall` are embedded — there is no separate `.nnue` download for any flavour.

## 10. Unverified / open questions

- **Official Stockfish UCI wiki page** (`github.com/official-stockfish/Stockfish/wiki/UCI-&-Commands`) could not be fetched (JS-rendered / 404 on raw mirrors). Option ranges above were verified directly from the engine's `uci` output and the `sf_18` source (`engine.cpp`, `search.h`, `search.cpp`); the "score is side-to-move relative" rule was confirmed empirically (negative scores with Black to move) and via `uci.cpp:format_score`, not from prose docs.
- **Exact minimum Safari/iOS version**: the build uses `-msimd128`, so WASM SIMD is required; README claims iOS 16+/macOS 11+. Not tested on Safari here.
- **Next.js dev/prod and Vercel serving `.wasm` from `/public` with `Content-Type: application/wasm`**: expected (standard mime tables; a `serve-handler` mime table in Next includes `application/wasm`) but not exercised through `next dev` in this session — verify on first run; the wrapper has no non-streaming fallback.
- **`ULTRA_LITE_NET` build**: upstream `build.js` supports it, but no artifact is in the npm package; size/strength unknown. Requires emscripten 3.1.7 to build.
- **Vercel function bundle limits** with the 7.3 MB wasm included (should be well under the 250 MB unzipped limit) — not measured.
- Full multi-threaded build (`stockfish-18.js`) was not executed in Node (needs `worker_threads` + SAB; the postinstall default symlink points at it). Only `lite-single` and `single` were executed.
- `go movetime` accuracy under ASYNCIFY in the browser on low-end mobiles (FR-38 < 3 s) — measured only on this Mac (depth 10, MultiPV 2: ~110 ms of search).
