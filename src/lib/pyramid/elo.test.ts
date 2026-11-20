import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eloDeltas, eloRatings } from "./elo.ts";
import type { Match } from "./types.ts";

function match(partial: Partial<Match> & Pick<Match, "id" | "playedAt">): Match {
  return {
    winnerId: "a",
    loserId: "b",
    winnerName: "A",
    loserName: "B",
    winnerScore: 1,
    loserScore: 0,
    winnerRankBefore: 1,
    loserRankBefore: 2,
    swapped: false,
    stipAwarded: false,
    note: "",
    challengeId: null,
    ...partial,
  };
}

describe("eloRatings", () => {
  it("geeft 16 punten bij een gelijke start", () => {
    const ratings = eloRatings(
      ["a", "b"],
      [match({ id: "1", playedAt: "2026-11-01T12:00:00.000Z" })],
    );
    assert.equal(ratings.get("a"), 1216);
    assert.equal(ratings.get("b"), 1184);
    const swing = eloDeltas([match({ id: "1", playedAt: "2026-11-01T12:00:00.000Z" })]);
    assert.equal(swing.get("1")?.get("a"), 16);
    assert.equal(swing.get("1")?.get("b"), -16);
  });

  it("houdt een gelijkspel gelijk als de ratings gelijk zijn", () => {
    const ratings = eloRatings(
      ["a", "b"],
      [match({ id: "1", playedAt: "2026-11-01T12:00:00.000Z", winnerScore: 1, loserScore: 1 })],
    );
    assert.equal(ratings.get("a"), 1200);
    assert.equal(ratings.get("b"), 1200);
  });

  it("verdeelt een groep per paar, met een kleinere K", () => {
    const ratings = eloRatings(
      ["a", "b", "c"],
      [
        match({
          id: "1",
          playedAt: "2026-11-01T12:00:00.000Z",
          sides: [
            { id: "a", name: "A", score: 2, rankBefore: 1, rankAfter: 1 },
            { id: "b", name: "B", score: 1, rankBefore: 2, rankAfter: 2 },
            { id: "c", name: "C", score: 0, rankBefore: 3, rankAfter: 3 },
          ],
        }),
      ],
    );
    assert.equal(ratings.get("a"), 1216);
    assert.equal(ratings.get("b"), 1200);
    assert.equal(ratings.get("c"), 1184);
  });

  it("gebruikt de rating van de vorige partij", () => {
    const ratings = eloRatings(
      ["a", "b"],
      [
        match({ id: "1", playedAt: "2026-11-01T12:00:00.000Z" }),
        match({ id: "2", playedAt: "2026-11-02T12:00:00.000Z", winnerId: "b", loserId: "a", winnerScore: 1, loserScore: 0 }),
      ],
    );
    assert.equal(ratings.get("a"), 1199);
    assert.equal(ratings.get("b"), 1201);
  });
});
