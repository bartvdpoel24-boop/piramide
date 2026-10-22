import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canChallengeUp, canInviteDown, isPyramidAdmin, legalDistance, normalizeSlots, nudgePlayer, removePlayer, settleMatch } from "./rules.ts";
import type { Player } from "./types.ts";

function player(id: string, rank: number): Player {
  return {
    id,
    name: id,
    rank,
    stippen: 0,
    note: "cream",
    userId: null,
    availability: [],
  };
}

const four = [player("a", 1), player("b", 2), player("c", 3), player("d", 6)];

describe("piramide rules", () => {
  it("allows a challenge at most four places up", () => {
    assert.equal(canChallengeUp(5, 1, 4), true);
    assert.equal(canChallengeUp(6, 1, 4), false);
    assert.equal(canChallengeUp(2, 3, 4), false);
    assert.equal(canInviteDown(2, 3, 4), true);
    assert.equal(canInviteDown(2, 6, 4), true);
    assert.equal(canInviteDown(2, 7, 4), false);
    assert.equal(canInviteDown(3, 2, 4), false);
    assert.equal(isPyramidAdmin({ id: "p-bart", name: "Iemand anders" }), true);
    assert.equal(isPyramidAdmin({ id: "x", name: "Bart van der Poel" }), true);
    assert.equal(isPyramidAdmin({ id: "x", name: "Louis" }), false);
    assert.equal(legalDistance(1, 5, 4), true);
    assert.equal(legalDistance(1, 6, 4), false);
  });

  it("swaps places when the lower player wins", () => {
    const result = settleMatch(four, "c", "b", 2, 1);
    assert.equal(result.swapped, true);
    assert.equal(result.stipAwarded, false);
    assert.equal(result.players.find((item) => item.id === "c")?.rank, 2);
    assert.equal(result.players.find((item) => item.id === "b")?.rank, 3);
  });

  it("awards a stip when the king holds the throne", () => {
    const result = settleMatch(four, "a", "b", 1, 0);
    assert.equal(result.swapped, false);
    assert.equal(result.stipAwarded, true);
    assert.equal(result.players.find((item) => item.id === "a")?.stippen, 1);
    assert.equal(result.players.find((item) => item.id === "a")?.rank, 1);
  });

  it("keeps every card on a draw and rejects a match outside the range", () => {
    const result = settleMatch(four, "a", "b", 1, 1);
    assert.equal(result.draw, true);
    assert.equal(result.swapped, false);
    assert.equal(result.stipAwarded, false);
    assert.equal(result.players.find((item) => item.id === "a")?.rank, 1);
    assert.equal(result.players.find((item) => item.id === "a")?.stippen, 0);
    assert.equal(result.players.find((item) => item.id === "b")?.rank, 2);
    assert.throws(() => settleMatch(four, "a", "d", 1, 0), /4 plaatsen/);
  });

  it("allows several times on one day and rejects an overlap", () => {
    const slots = normalizeSlots([
      { day: 1, startMin: 16 * 60, endMin: 17 * 60 },
      { day: 1, startMin: 12 * 60, endMin: 13 * 60 },
    ]);
    assert.deepEqual(slots, [
      { day: 1, startMin: 12 * 60, endMin: 13 * 60 },
      { day: 1, startMin: 16 * 60, endMin: 17 * 60 },
    ]);
    assert.throws(
      () =>
        normalizeSlots([
          { day: 1, startMin: 12 * 60, endMin: 13 * 60 },
          { day: 1, startMin: 12 * 60 + 30, endMin: 14 * 60 },
        ]),
      /overlappen/,
    );
  });

  it("nudges and closes the gap after a removal", () => {
    const nudged = nudgePlayer(four, "c", -1);
    assert.equal(nudged.find((item) => item.id === "c")?.rank, 2);
    const left = removePlayer(four, "b");
    assert.deepEqual(
      left.map((item) => [item.id, item.rank]),
      [
        ["a", 1],
        ["c", 2],
        ["d", 5],
      ],
    );
  });
});
