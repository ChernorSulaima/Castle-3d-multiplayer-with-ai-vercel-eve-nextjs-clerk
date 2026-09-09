// agent/tools/analyse_position.ts — §F.5
//
// Tool name = filename slug -> "analyse_position".
//
// Candidates are computed by the player's browser Stockfish worker and handed to the
// model through `clientContext`, so this tool is ONLY the "candidates were empty"
// escape hatch named in instructions.md. It must never load an engine on the server:
// a Node Stockfish would add 128 MB per invocation and, more importantly, one tool
// round-trip costs ~2-2.5 s, which alone blows FR-38 (eve-agent.md A.7/A.12).
//
// `clientContext` is delivered to the MODEL, not to tools, so `candidates` is an
// optional INPUT here: the model can echo back what it was given and get a legality
// check for free (eve-agent.md §2.1, "Recommended minimal path").
import { defineTool } from "eve/tools";
import { z } from "zod";
import { Chess } from "chess.js";

const candidateSchema = z.object({
  san: z.string(),
  uci: z.string().default(""),
  scoreCp: z.number().nullable().default(null),
  mateIn: z.number().nullable().default(null),
  depth: z.number().int().default(0),
  pv: z.array(z.string()).default([]),
});

export default defineTool({
  description:
    "Legality helper for a chess position. Returns every legal move in the FEN as SAN, and " +
    "filters a supplied candidate list down to the legal ones. Call this at most once per turn, " +
    "and only when the caller gave you neither candidates nor legalMoves.",
  inputSchema: z.object({
    fen: z.string().min(10).describe("Position in Forsyth-Edwards Notation"),
    multiPv: z.number().int().min(1).max(8).default(4).describe("How many candidates to return"),
    candidates: z
      .array(candidateSchema)
      .default([])
      .describe("Optional: the candidate list you were given, to be legality-checked"),
  }),
  outputSchema: z.object({
    fen: z.string(),
    legalMoves: z.array(z.string()),
    candidates: z.array(candidateSchema),
    source: z.enum(["client", "none"]),
    inCheck: z.boolean(),
    turn: z.enum(["w", "b"]),
  }),
  execute({ fen, multiPv, candidates }) {
    // Throws on an invalid FEN, which eve surfaces to the model as a tool error.
    const chess = new Chess(fen);
    const legalMoves = chess.moves();
    const legal = new Set(legalMoves);
    const filtered = candidates.filter((c) => legal.has(c.san)).slice(0, multiPv);
    return {
      fen,
      legalMoves,
      candidates: filtered,
      source: filtered.length > 0 ? ("client" as const) : ("none" as const),
      inCheck: chess.inCheck(),
      turn: chess.turn(),
    };
  },
});
