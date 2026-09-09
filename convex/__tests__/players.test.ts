import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, readPlayer, signUp } from "./harness.setup";

describe("players.ensurePlayer", () => {
  test("provisions a row from the Clerk identity and is idempotent", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const again = await as(t, alice).mutation(api.players.ensurePlayer, {});
    expect(again).toBe(alice.id);

    const row = await readPlayer(t, alice.id);
    expect(row.username).toBe("alice");
    expect(row.usernameLower).toBe("alice");
    expect(row.clerkId).toBe("user_alice");
    expect(row.tokenIdentifier.length).toBeGreaterThan(0);
    expect(row.rating).toBe(1200);
    expect(row.ratingHuman).toBe(1200);
    expect(row.ratingAi).toBe(1200);
    expect(row.boardView).toBe("3d");
    expect(row.roomPreset).toBe("study");

    const all = await t.run(async (ctx) => ctx.db.query("players").take(10));
    expect(all).toHaveLength(1);
  });

  test("refreshes username and avatar when Clerk changes them", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    await t
      .withIdentity({
        subject: alice.identity.subject,
        nickname: "AliceRenamed",
        pictureUrl: "https://img.clerk.com/new.png",
      })
      .mutation(api.players.ensurePlayer, {});

    const row = await readPlayer(t, alice.id);
    expect(row.username).toBe("AliceRenamed");
    expect(row.usernameLower).toBe("alicerenamed");
    expect(row.avatarUrl).toBe("https://img.clerk.com/new.png");
  });

  test("rejects unauthenticated callers", async () => {
    const t = makeTest();
    await expect(t.mutation(api.players.ensurePlayer, {})).rejects.toThrow(
      /Not authenticated/,
    );
  });
});

describe("players queries", () => {
  test("me returns the caller's row and null when signed out", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const mine = await as(t, alice).query(api.players.me, {});
    expect(mine?.username).toBe("alice");
    expect(mine?.roomImageUrl).toBeNull();
    expect(await t.query(api.players.me, {})).toBeNull();
  });

  test("getByUsername is case-insensitive and hides private fields", async () => {
    const t = makeTest();
    await signUp(t, "Alice");
    const profile = await t.query(api.players.getByUsername, { username: "aLiCe" });
    expect(profile?.username).toBe("Alice");
    expect(profile).not.toHaveProperty("clerkId");
    expect(profile).not.toHaveProperty("qualityTier");
    expect(await t.query(api.players.getByUsername, { username: "nobody" })).toBeNull();
  });
});

describe("players.updateSettings", () => {
  test("patches only the supplied keys and clears roomColors with null", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await as(t, alice).mutation(api.players.updateSettings, {
      boardView: "2d",
      roomColors: {
        background: "#101014",
        lightSquare: "#eeeed2",
        darkSquare: "#769656",
      },
    });
    let row = await readPlayer(t, alice.id);
    expect(row.boardView).toBe("2d");
    expect(row.roomColors?.darkSquare).toBe("#769656");
    expect(row.roomPreset).toBe("study"); // untouched

    await as(t, alice).mutation(api.players.updateSettings, { roomColors: null });
    row = await readPlayer(t, alice.id);
    expect(row.roomColors).toBeUndefined();
    expect(row.boardView).toBe("2d");
  });

  test("rejects non-hex colours", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    await expect(
      as(t, alice).mutation(api.players.updateSettings, {
        roomColors: { background: "red", lightSquare: "#ffffff", darkSquare: "#000000" },
      }),
    ).rejects.toThrow(/invalid-colour/);
  });

  test("requires a provisioned player", async () => {
    const t = makeTest();
    await expect(
      t
        .withIdentity({ subject: "user_ghost", nickname: "ghost" })
        .mutation(api.players.updateSettings, { boardView: "2d" }),
    ).rejects.toThrow(/Player not provisioned/);
  });
});
