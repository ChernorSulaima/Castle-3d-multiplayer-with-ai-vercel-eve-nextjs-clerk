// scripts/copy-stockfish.mjs
//
// Refreshes public/stockfish/sf11/ from the installed stockfish@11.0.0 package.
// The three output files are COMMITTED to the repo, so this is NOT a postinstall hook —
// run it by hand (`pnpm copy:stockfish`) only when upgrading the engine, and bump the
// `sf11` directory name at the same time (the /stockfish/:path* cache header in
// next.config.ts is `immutable`, so the path is the cache key).
//
// Source of the file layout: docs/research/stockfish.md §3.1.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "stockfish");
const to = join(root, "public", "stockfish", "sf11");

if (!existsSync(from)) {
  console.warn("[stockfish] package not installed yet, skipping copy");
  process.exit(0);
}
await mkdir(to, { recursive: true });
await copyFile(join(from, "src/stockfish.js"), join(to, "stockfish.js"));
await copyFile(join(from, "src/stockfish.wasm"), join(to, "stockfish.wasm"));
await copyFile(join(from, "license.txt"), join(to, "LICENSE-GPL-3.0.txt")); // GPLv3 compliance
console.log("[stockfish] stockfish@11.0.0 copied to public/stockfish/sf11");
