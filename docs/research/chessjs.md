# chess.js 1.4.0 — verified API reference for the 3D chess project

Scope: everything a server-validated (Convex mutation) multiplayer chess app needs from chess.js. Every claim below was verified against the installed package at `node_modules/chess.js` (version 1.4.0, BSD-2-Clause) — `package.json`, `README.md`, `dist/types/chess.d.ts`, `dist/esm/chess.js` — and by executing a Node 24 script against `dist/esm/chess.js`. Source tags: `[d.ts]`, `[README]`, `[src]` (dist/esm/chess.js), `[run]` (executed and observed).

Requirements this maps to (`/Users/sonnysangha/Downloads/3dchessrequirements.md`): FR-9 (all rules via chess.js), FR-10/NFR-4 (server-side validation in Convex mutations), FR-11 (promotion picker), FR-12 (store FEN + SAN list + PGN + turn + status + result), FR-13 (statuses), FR-16 (captured-pieces tray), FR-36 (validate Eve's SAN move), FR-44 (undo = replay truncated SAN list), FR-47 (PGN export).

---

## 1. Package shape and importing

- `package.json` `[d.ts][run]`: `"main": "dist/cjs/chess.js"`, `"module": "dist/esm/chess.js"`, `"types": "dist/types/chess.d.ts"`. **There is no `exports` field and no `"type"` field.** Bundlers (Next/Turbopack, Convex's esbuild) pick the ESM build via `module`; plain Node `require`/`import` picks `main` (CJS). Both project tsconfigs use `moduleResolution: "bundler"`, so `import { Chess } from 'chess.js'` type-checks fine.
- Single module, no subpath imports. Deep-importing `chess.js/dist/esm/chess.js` works but is unnecessary.
- **Named exports only, no default export** `[run]`: `Object.keys(mod)` = `BISHOP, BLACK, Chess, DEFAULT_POSITION, KING, KNIGHT, Move, PAWN, QUEEN, ROOK, SEVEN_TAG_ROSTER, SQUARES, WHITE, validateFen, xoroshiro128`. `'default' in mod === false`. `import Chess from 'chess.js'` will NOT work.
- Type-only exports `[d.ts]`: `Color`, `Piece`, `PieceSymbol`, `Square`.

```ts
import { Chess, Move, DEFAULT_POSITION, SQUARES, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, validateFen } from 'chess.js'
import type { Color, Piece, PieceSymbol, Square } from 'chess.js'
```

### Constants and types `[d.ts]`
```ts
const WHITE = 'w'; const BLACK = 'b'
const PAWN = 'p'; const KNIGHT = 'n'; const BISHOP = 'b'; const ROOK = 'r'; const QUEEN = 'q'; const KING = 'k'
type Color = 'w' | 'b'
type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
type Square = 'a8' | 'b8' | ... | 'h1'            // all 64, a string-literal union
type Piece = { color: Color; type: PieceSymbol }
const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const SQUARES: Square[]                           // length 64, ordered a8..h8, a7..h7, ..., a1..h1  [run]
const SEVEN_TAG_ROSTER: Record<string,string>     // { Event:'?', Site:'?', Date:'????.??.??', Round:'?', White:'?', Black:'?', Result:'*' } [src]
function validateFen(fen: string): { ok: boolean; error?: string }
```
Note `BISHOP` and `BLACK` are both the string `'b'`; they are disambiguated only by which field you put them in (`type` vs `color`).

---

## 2. Runtime compatibility (Convex default runtime, Next.js server/client, Web Worker)

- `[src]` `grep` of `dist/esm/chess.js` for `require(`, `fs`, `process.`, `Buffer`, `__dirname`, `import ` returned **nothing**. The bundle is dependency-free, pure ES2022-style JS (class fields, optional chaining, `Map`).
- `[src]` It uses **BigInt** at module-evaluation time (`xoroshiro128`, `0x...n` literals, `MASK64`) for Zobrist hashing (`hash()`, threefold repetition). Any runtime without BigInt will fail at import.
- Convex default runtime `[context7: docs.convex.dev/functions/runtimes]`: "supports most npm libraries compatible with browsers, Deno, and Cloudflare Workers"; queries and mutations can import npm packages; `"use node"` is only for libraries that need Node built-ins. chess.js needs none. BigInt is a first-class Convex value (`v.int64()` maps to `bigint`; `Value` union includes `bigint`) `[node_modules/convex/dist/esm-types/values/validator.d.ts:45,142; value.d.ts:45]`, so the runtime has BigInt.
- Conclusion: **chess.js can be imported directly in Convex mutations/queries (default runtime), Next.js server components/route handlers, client components, and Web Workers.** No `"use node"` needed. chess.js README: "extensively tested in node.js and most modern browsers" `[README]`.
- The `convex/tsconfig.json` already targets `ESNext` / `lib: ES2023`, which covers BigInt literals for type-checking.

---

## 3. Constructor, load, reset, clear

```ts
new Chess(fen?: string, { skipValidation?: boolean } = {})   // [d.ts]
chess.load(fen: string, { skipValidation?: boolean; preserveHeaders?: boolean } = {}): void
chess.reset(): void                                           // = load(DEFAULT_POSITION)  [src]
chess.clear({ preserveHeaders?: boolean } = {}): void         // empty board '8/8/8/8/8/8/8/8 w - - 0 1'
```
- Invalid FEN **throws** `Error` from both the constructor and `load()` `[README][src:1847][run]`. Observed message: `Invalid FEN: must contain six space-delimited fields` for `'garbage'`. With `{ skipValidation: true }` no throw `[run]`.
- `load()` accepts FEN with 2–5 fields and pads castling/ep/halfmove/fullmove with `- - 0 1` `[src:1836-1842][README]`.
- **`load()` (and therefore `reset()`) calls `clear()`, which wipes `_history`, `_comments`, and the repetition `_positionCount` map** `[src clear()]`. Verified `[run]`: after `move('e4'); load(fen)`, `undo()` returns `null` and `history().length === 0`. Consequence: a `Chess` built from a stored FEN has **no history and cannot detect threefold repetition** for positions that occurred before the load. For server validation of threefold/fifty-move you must replay the SAN list from the start (see section 11), not just load the FEN.
- Loading a non-default FEN auto-sets PGN headers `SetUp: '1'` and `FEN: <fen>` (only if history is empty) `[src _updateSetup]`.

---

## 4. Making moves: `move()`

```ts
chess.move(
  move: string | { from: string; to: string; promotion?: string } | null,
  { strict?: boolean } = {},
): Move                                                       // [d.ts]
```
- **Illegal / unparsable move THROWS** (it never returns `null` in 1.x) `[src:2527-2530][run]`:
  - string input: `Error("Invalid move: e5")`
  - object input: `Error("Invalid move: {\"from\":\"e2\",\"to\":\"e5\"}")`
  - `move(null)` performs a *null move* (SAN `'--'`) and throws `Error('Null move not allowed when in check')` if in check `[src:2535][run]`. Never pass `null` from user input; reject it before calling.
- SAN is **case-sensitive**: `move('nf3')` throws `[README][run]`.
- Default parser is **permissive**: accepts `e2e4`, `e7-e5`, `Pf2-f4`, `ef4`, `Ng1-f3`, `d7xd6`, sloppy disambiguation `[README][run]`. `{ strict: true }` accepts only spec-compliant SAN; `move('e2e4', { strict: true })` throws `[run]`. Recommendation: for Eve-produced SAN (FR-36) use permissive mode (the model may emit LAN); for stored SAN lists (which chess.js itself generated) either works.
- Object form: matched against generated legal moves by `from`, `to`, and, **when the legal move is a promotion, `promotion` must equal exactly** `[src:2512-2518]`. Verified `[run]`: on `4k3/1P6/8/8/8/8/8/4K3 w - - 0 1`, `move({ from:'b7', to:'b8' })` throws `Invalid move: {...}`; `move({ from:'b7', to:'b8', promotion:'q' })` returns `{ san:'b8=Q+', lan:'b7b8q', promotion:'q', flags:'np' }`. So a UI must supply `promotion` or the server will reject the move; there is no implicit auto-queen.
- On non-promotion moves an extraneous `promotion` field is ignored (the matcher only checks it when the generated move has a promotion) `[src]`.
- SAN promotion form is `b8=Q` (chess.js adds `+`/`#` itself) `[run]`.
- Returned `Move` is computed **before** the board mutates (SAN/`before`/`after` are generated by temporarily making and undoing the move) `[src:2540-2545]`.

---

## 5. The `Move` object `[d.ts][src][run]`

`Move` is a class (exported), returned by `move()`, `undo()`, `moves({verbose:true})`, `history({verbose:true})`.

| Field | Type | Notes |
|---|---|---|
| `color` | `Color` | mover |
| `from`, `to` | `Square` | |
| `piece` | `PieceSymbol` | moving piece |
| `captured?` | `PieceSymbol` | set on captures **and en passant** (`'p'`) `[run]` |
| `promotion?` | `PieceSymbol` | set on promotions |
| `flags` | `string` | **deprecated, removed in 2.0** `[d.ts]`. Chars: `n` normal, `c` capture, `b` big pawn (2-square), `e` en passant, `p` promotion, `k` kingside castle, `q` queenside castle, `-` null move `[src FLAGS]` |
| `san` | `string` | e.g. `Qxf7#`, `O-O`, `b8=Q+` |
| `lan` | `string` | `from+to`, **plus promotion letter when promoting** (`b7b8q`) `[src][run]`. Castling LAN is king move `e1g1` `[run]` — this is UCI format, directly usable with Stockfish. |
| `before` | `string` | FEN before the move |
| `after` | `string` | FEN after the move |

Methods `[d.ts]`: `isCapture()`, `isPromotion()`, `isEnPassant()`, `isKingsideCastle()`, `isQueensideCastle()`, `isBigPawn()`.

Gotchas:
- **`isCapture()` is `false` for en passant** (`isEnPassant()` is `true`, `captured === 'p'`) `[README][run]`. For a captured-pieces tray use `move.captured` (truthy check), not `isCapture()`.
- There is **no `isCastle()`** despite the deprecation comment mentioning it; use `isKingsideCastle() || isQueensideCastle()` `[d.ts]`.
- `captured` and `promotion` are declared class fields, so `Object.keys(move)` always lists them and `'captured' in move` is always `true` even when `undefined` `[run]`. Test with `move.captured !== undefined` / truthiness. `JSON.stringify(move)` drops the undefined ones and the methods `[run]` — a serialised `Move` is a plain object without `isCapture()` etc.; if you store it in Convex, store the fields you need explicitly.

---

## 6. Legal move generation: `moves()`

```ts
chess.moves(): string[]                                          // SAN list
chess.moves({ square }: { square: Square }): string[]
chess.moves({ piece }: { piece: PieceSymbol }): string[]
chess.moves({ verbose: true, square?, piece? }): Move[]
chess.moves({ verbose: false, square?, piece? }): string[]
chess.moves({ verbose?: boolean, square?, piece? }): string[] | Move[]
```
`[d.ts]` (many overloads). `square` and `piece` are case-insensitive inside `_moves` `[src]`. An unknown square (`moves({ square: 'zz' })`) returns `[]` rather than throwing `[src][run]`. Empty array also when the game is over or the square holds no piece of the side to move.

Promotion detection for a UI (FR-11): `moves({ square: from, verbose: true }).filter(m => m.to === to)` — if any has `isPromotion()` (or `promotion` set) there will be exactly four (`b8=N b8=B b8=R+ b8=Q+`) `[run]`; show the picker, then call `move({ from, to, promotion })`.

---

## 7. Position queries

```ts
chess.fen({ forceEnpassantSquare?: boolean } = {}): string
chess.turn(): Color
chess.moveNumber(): number                     // full-move number from FEN field 6 [run: 4 after 7 plies]
chess.board(): ({ square: Square; type: PieceSymbol; color: Color } | null)[][]   // 8 rows, row 0 = rank 8 (a8..h8), row 7 = rank 1 [run]
chess.get(square: Square): Piece | undefined   // undefined when empty [run]
chess.findPiece(piece: Piece): Square[]        // e.g. findPiece({ type: KING, color: WHITE }) -> ['e1'] [run]
chess.squareColor(square: Square): 'light' | 'dark' | null   // null for bogus input [run]
chess.hash(): string                           // 64-bit Zobrist hex, e.g. '3436f01fd716346e' for start position [run]
chess.ascii(): string
chess.perft(depth: number): number
chess.getCastlingRights(color: Color): { k: boolean; q: boolean }   // keys are the KING/QUEEN constants 'k'/'q' [d.ts][run]
chess.setCastlingRights(color: Color, rights: Partial<{ k: boolean; q: boolean }>): boolean
chess.isAttacked(square: Square, attackedBy: Color): boolean       // ignores side to move; own pieces / empty squares count [README][run]
chess.attackers(square: Square, attackedBy?: Color): Square[]      // defaults to side to move; pinned pieces still count [README]
chess.put(piece: { type: PieceSymbol; color: Color }, square: Square): boolean  // false on invalid piece/square or 2nd king of same colour [README][run]
chess.remove(square: Square): Piece | undefined
chess.setTurn(color: Color): boolean          // true if changed; throws if side to move is in check [README]
```

**FEN en passant gotcha** `[src _updateEnPassantSquare, fen()][run]`: chess.js only records/prints the en passant square when a pawn of the side to move can actually capture (after `1.e4` the FEN's 4th field is `-`, and even `forceEnpassantSquare: true` printed `-` because the internal square had already been cleared). Stockfish/lichess print `e3` there. Do **not** compare chess.js FENs byte-for-byte against FENs from other tools; when handing a FEN to Stockfish this is harmless (fewer ep squares, never wrong ones).

---

## 8. Game status

```ts
chess.isCheck(): boolean          // side to move is in check
chess.inCheck(): boolean          // alias of isCheck() [src:2264]
chess.isCheckmate(): boolean      // isCheck() && no legal moves
chess.isStalemate(): boolean      // !isCheck() && no legal moves
chess.isInsufficientMaterial(): boolean   // K v K, K v KN, K v KB, and any-number-of-bishops all on one colour [src]
chess.isThreefoldRepetition(): boolean    // position hash count >= 3 in *this object's* history [src]
chess.isDrawByFiftyMoves(): boolean       // halfmove clock >= 100 [src]
chess.isDraw(): boolean           // fiftyMoves || stalemate || insufficient || threefold  [src:2336-2341]
chess.isGameOver(): boolean       // checkmate || isDraw()  [src:2342]
```
- `isDraw()` **includes stalemate** in 1.4.0 (`[src]`; the README text saying "50-move rule or insufficient material" is stale). Check `isCheckmate()`/`isStalemate()` before `isDraw()` if you need distinct statuses (FR-13 has separate `checkmate`, `stalemate`, `draw`).
- Threefold and fifty-move are automatic (no claim step) — `isGameOver()` becomes true as soon as they occur `[run]`. The fifty-move counter is read from the FEN, so it survives a `load()`; threefold does not (section 3).
- Winner on checkmate is the opposite of `turn()` (side to move is the mated side).

---

## 9. History, undo, PGN, headers, comments

```ts
chess.history(): string[]                       // SAN
chess.history({ verbose: true }): Move[]        // each with before/after FEN
chess.undo(): Move | null                       // null when nothing to undo [run]
chess.pgn({ newline?: string; maxWidth?: number } = {}): string
chess.setHeader(key: string, value: string): Record<string,string>
chess.getHeaders(): Record<string,string>
chess.removeHeader(key: string): boolean
chess.header(...args: string[]): Record<string, string|null>   // DEPRECATED: returns ~30 null placeholder tags too [d.ts][run]
chess.loadPgn(pgn: string, { strict?: boolean; newlineChar?: string } = {}): void   // throws on bad PGN / bad move: 'Invalid move in PGN: Qxe5' [run]
chess.getComment(): string; chess.setComment(c: string): void; chess.removeComment(): string
chess.getComments(): { fen: string; comment: string }[]; chess.removeComments(): same
// deleteComment()/deleteComments() are deprecated aliases [d.ts]
```
- **Performance**: `history()` (both forms) and `pgn()` undo every move to the start and replay them, regenerating SAN each time `[src history(), pgn()]`. O(n) per call with real work per ply; call once per mutation, never inside a per-move loop.
- **`pgn()` in 1.4.0 always emits the Seven Tag Roster** with `?` placeholders plus `[Result "*"]` even when you set nothing `[src HEADER_TEMPLATE][run]`:
  `[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n1. e4 e5 ... *`. (The README example showing only White/Black is stale.) The trailing result token is `this._header.Result || '*'` `[src]` — set `setHeader('Result', '1-0' | '0-1' | '1/2-1/2')` yourself when the game ends; chess.js does not infer it. Set `White`/`Black`/`Date`/`Event` from your game doc for FR-47 export.
- If the game started from a custom FEN, `pgn()` includes `[SetUp "1"]` and `[FEN "..."]` `[src _updateSetup]`; `loadPgn` requires `FEN` when `SetUp` is present `[src:2950]`.
- `loadPgn` default `newlineChar` is `\r?\n`; parse errors throw `[README][run]`.
- Comments are keyed by FEN of the position they annotate `[README][run]`; `setComment` after a move annotates the resulting position and appears as `1. e4 {hi}` in PGN `[run]`. Useful for storing Eve commentary in the exported PGN.

---

## 10. Verified end-to-end snippet (server-side validation helpers)

Executed against the installed build `[run]`; outputs noted in comments.

```ts
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

// ---- 1. Replay a SAN move list from the start position (FR-44 undo, FR-10 validation)
export function replay(sans: string[], startFen?: string): Chess {
  const chess = startFen ? new Chess(startFen) : new Chess()   // throws on invalid FEN
  for (const san of sans) chess.move(san)                       // throws Error('Invalid move: X') on the first illegal SAN
  return chess
}

// ---- 2. Validate + apply one incoming move inside a Convex mutation
export type Incoming = { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | string
export function applyMove(chess: Chess, input: Incoming, expectedColor: Color) {
  if (chess.turn() !== expectedColor) throw new Error('Not your turn')
  try {
    return chess.move(input)          // permissive parser; use { strict: true } if input is guaranteed SAN
  } catch {
    throw new Error('Illegal move')   // chess.js throws; never returns null in 1.x
  }
}

// ---- 3. Does from->to need a promotion choice? (FR-11)
export function needsPromotion(chess: Chess, from: Square, to: Square): boolean {
  return chess.moves({ square: from, verbose: true }).some(m => m.to === to && m.isPromotion())
  // start pos 4k3/1P6/8/8/8/8/8/4K3 w: needsPromotion(c,'b7','b8') === true; moves are b8=N b8=B b8=R+ b8=Q+
}

// ---- 4. Game status string matching FR-13 / games.status + games.winner
export type Status =
  | { status: 'active'; inCheck: boolean }
  | { status: 'checkmate'; winner: Color }
  | { status: 'stalemate'; winner: 'draw' }
  | { status: 'draw'; winner: 'draw'; reason: 'threefold' | 'insufficient' | 'fifty-move' }
export function gameStatus(chess: Chess): Status {
  if (chess.isCheckmate()) return { status: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { status: 'stalemate', winner: 'draw' }   // check BEFORE isDraw(): isDraw() includes stalemate
  if (chess.isThreefoldRepetition()) return { status: 'draw', winner: 'draw', reason: 'threefold' }
  if (chess.isInsufficientMaterial()) return { status: 'draw', winner: 'draw', reason: 'insufficient' }
  if (chess.isDrawByFiftyMoves()) return { status: 'draw', winner: 'draw', reason: 'fifty-move' }
  return { status: 'active', inCheck: chess.inCheck() }
}
// replay(['e4','e5','Qh5','Nc6','Bc4','Nf6','Qxf7#']) -> { status:'checkmate', winner:'w' }; isGameOver() true; fen ends '... b KQkq - 0 4'

// ---- 5. Captured pieces from history (FR-16 tray). Keyed by the capturer's colour.
export function capturedPieces(chess: Chess): Record<Color, PieceSymbol[]> {
  const out: Record<Color, PieceSymbol[]> = { w: [], b: [] }
  for (const m of chess.history({ verbose: true })) {
    if (m.captured) out[m.color].push(m.captured)   // truthy check: field exists but is undefined on quiet moves; en passant sets 'p'
  }
  return out
}
// Scholar's mate above -> { w: ['p'], b: [] }

// ---- 6. Persisted snapshot for the games doc (FR-12)
export function snapshot(chess: Chess, result?: '1-0' | '0-1' | '1/2-1/2') {
  if (result) chess.setHeader('Result', result)
  return {
    fen: chess.fen(),
    moves: chess.history(),           // SAN[]
    pgn: chess.pgn(),                 // includes seven-tag roster + '[Result ...]'
    turn: chess.turn(),
    lastMoveUci: chess.history({ verbose: true }).at(-1)?.lan,  // 'e2e4' / 'e7e8q' — Stockfish-compatible
  }
}
```

Recommended mutation flow (FR-10, NFR-4): load `game.moves` (SAN[]) -> `replay()` (so threefold works) -> assert `turn()` matches the caller's colour -> `applyMove()` -> `gameStatus()` -> write `fen`, `moves`, `pgn`, `status`, `winner`. Replaying ~100 plies is cheap; if games get long, cache `fen` for reads only and keep the SAN list as the source of truth. For Eve's suggested SAN (FR-36): `try { new Chess(fen).move(san) } catch { fallbackToStockfishBestMove() }` — note a FEN-constructed instance can't see repetition history, which is fine for a legality check.

Stockfish interop: feed Stockfish `position fen <chess.fen()>` or `position startpos moves <history({verbose:true}).map(m=>m.lan).join(' ')>`; convert Stockfish `bestmove e7e8q` back with `chess.move({ from: 'e7', to: 'e8', promotion: 'q' })` (or just `chess.move('e7e8q')`, which the permissive parser accepts `[run: 'e2e4' accepted]`).

---

## 11. Breaking changes vs 0.x to watch for (1.x-specific behaviour verified above)

- `move()` **throws** on illegal moves (0.x returned `null`). Wrap in try/catch.
- Constructor/`load()` **throw** on invalid FEN (0.x `load()` returned `false`). `validateFen()` is the non-throwing check.
- `new Chess()` must be called with `new` (class). README's `Chess()` without `new` in the `squareColor` example is a typo.
- `header()` is deprecated (returns null placeholder tags) — use `setHeader`/`getHeaders`/`removeHeader`.
- `deleteComment(s)` deprecated -> `removeComment(s)`.
- `Move.flags` deprecated (removed in 2.0) -> use `isCapture()`/`isPromotion()`/etc.
- `game_over()`, `in_check()`, `in_checkmate()`, snake_case names are gone; use the camelCase names listed above (`isGameOver`, `inCheck`/`isCheck`, `isCheckmate`, ...).
- `Move` gained `lan`, `before`, `after`.

---

## Unverified / open questions

- Convex default-runtime import of chess.js was verified indirectly (no Node APIs in dist; Convex docs say browser-compatible npm packages are supported; BigInt is a Convex value type). It was **not** executed inside an actual Convex deployment. First mutation using it should be smoke-tested with `npx convex dev`.
- The README text for `isDraw()` ("50-move rule or insufficient material") disagrees with the 1.4.0 source, which also includes stalemate and threefold. The source and a live run were treated as authoritative.
- `fen({ forceEnpassantSquare: true })` returned `-` after `1.e4` in the run, because `_epSquare` is cleared when no capturing pawn exists. Whether it ever differs from the default output in 1.4.0 (i.e. only in the "pinned ep pawn" case) was not tested.
- Precise cost of `history()`/`pgn()` on long games (they replay the whole game) was not benchmarked; expected to be well under a millisecond for a typical game, but measure before calling them multiple times per mutation.
- `perft()` and `xoroshiro128` are exported but irrelevant to the project; not exercised.
