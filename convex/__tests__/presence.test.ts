import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  as,
  backdateGame,
  backdatePresence,
  makeTest,
  readGame,
  readPlayer,
  seedGame,
  signUp,
} from "./harness.setup";

type T = ReturnType<typeof makeTest>;

async function presenceFor(t: T, gameId: Id<"games">): Promise<Array<Doc<"presence">>> {
  return await t.run(async (ctx) =>
    ctx.db
      .query("presence")
      .withIndex("by_gameId_and_playerId", (q) => q.eq("gameId", gameId))
      .take(20),
  );
}

describe("games.heartbeat", () => {
  test("upserts one presence row per viewer with the right role", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const mallory = await signUp(t, "mallory");
    const gameId = await seedGame(t, {
      mode: "online",
      whiteId: alice.id,
      blackId: bob.id,
    });

    await as(t, alice).mutation(api.games.heartbeat, { gameId });
    await as(t, alice).mutation(api.games.heartbeat, { gameId });
    await as(t, bob).mutation(api.games.heartbeat, { gameId });
    await as(t, mallory).mutation(api.games.heartbeat, { gameId });

    const rows = await presenceFor(t, gameId);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.role).sort()).toEqual(["b", "spectator", "w"]);

    // It must never touch the game document (§I-2).
    const game = await readGame(t, gameId);
    expect(game.moves).toEqual([]);
    expect(game.status).toBe("active");
  });
});

describe("games.sweepAbandoned", () => {
  async function stalledGame(t: T, white: { id: Id<"players"> }, black: { id: Id<"players"> }) {
    const gameId = await seedGame(t, {
      mode: "online",
      whiteId: white.id,
      blackId: black.id,
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("presence", {
        gameId,
        playerId: white.id,
        role: "w",
        lastSeen: now,
      });
      await ctx.db.insert("presence", {
        gameId,
        playerId: black.id,
        role: "b",
        lastSeen: now,
      });
    });
    await backdateGame(t, gameId, 120_000);
    return gameId;
  }

  test("leaves a game alone while both players are still present", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await stalledGame(t, alice, bob);

    await t.mutation(internal.games.sweepAbandoned, {});
    expect((await readGame(t, gameId)).status).toBe("active");
  });

  test("awards the win to the present side after 60 s of silence (FR-32)", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await stalledGame(t, alice, bob);
    await backdatePresence(t, gameId, bob.id, 120_000);

    await t.mutation(internal.games.sweepAbandoned, {});
    const game = await readGame(t, gameId);
    expect(game.status).toBe("abandoned");
    expect(game.winner).toBe("w");
    expect(game.endReason).toBe("abandonment");
    expect((await readPlayer(t, alice.id)).ratingHuman).toBe(1216);
    expect((await readPlayer(t, bob.id)).ratingHuman).toBe(1184);
  });

  test("both sides gone is a draw with NO rating change", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await stalledGame(t, alice, bob);
    await backdatePresence(t, gameId, alice.id, 120_000);
    await backdatePresence(t, gameId, bob.id, 120_000);

    await t.mutation(internal.games.sweepAbandoned, {});
    const game = await readGame(t, gameId);
    expect(game.status).toBe("abandoned");
    expect(game.winner).toBe("draw");

    const white = await readPlayer(t, alice.id);
    const black = await readPlayer(t, bob.id);
    expect(white.ratingHuman).toBe(1200);
    expect(black.ratingHuman).toBe(1200);
    expect(white.draws).toBe(0);
    expect(black.draws).toBe(0);
    const history = await t.run(async (ctx) => ctx.db.query("ratingHistory").take(10));
    expect(history).toHaveLength(0);
  });

  test("never sweeps AI or local games", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const ai = await seedGame(t, {
      mode: "ai",
      whiteId: alice.id,
      blackId: null,
      aiColor: "b",
      difficulty: "casual",
    });
    const local = await seedGame(t, {
      mode: "local",
      whiteId: alice.id,
      blackId: null,
    });
    await backdateGame(t, ai, 600_000);
    await backdateGame(t, local, 600_000);

    await t.mutation(internal.games.sweepAbandoned, {});
    expect((await readGame(t, ai)).status).toBe("active");
    expect((await readGame(t, local)).status).toBe("active");
  });

  test("refreshes the denormalised spectator count", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const mallory = await signUp(t, "mallory");
    const gameId = await stalledGame(t, alice, bob);
    await as(t, mallory).mutation(api.games.heartbeat, { gameId });

    await t.mutation(internal.games.sweepAbandoned, {});
    expect((await readGame(t, gameId)).spectatorCount).toBe(1);
  });

  test("is idempotent — a second sweep does not double-apply ratings", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await stalledGame(t, alice, bob);
    await backdatePresence(t, gameId, bob.id, 120_000);

    await t.mutation(internal.games.sweepAbandoned, {});
    await t.mutation(internal.games.sweepAbandoned, {});
    expect((await readPlayer(t, alice.id)).ratingHuman).toBe(1216);
    expect((await readGame(t, gameId)).status).toBe("abandoned");
  });
});

describe("games.gcPresence", () => {
  test("deletes rows nobody has refreshed for ten minutes", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await seedGame(t, {
      mode: "online",
      whiteId: alice.id,
      blackId: bob.id,
    });
    await as(t, alice).mutation(api.games.heartbeat, { gameId });
    await as(t, bob).mutation(api.games.heartbeat, { gameId });
    await backdatePresence(t, gameId, bob.id, 20 * 60_000);

    await t.mutation(internal.games.gcPresence, {});
    const rows = await presenceFor(t, gameId);
    expect(rows).toHaveLength(1);
    expect(rows[0].playerId).toBe(alice.id);
  });
});
