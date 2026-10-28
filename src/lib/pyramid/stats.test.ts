import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentStreaks, lastResults, monthWinShare, pyramidStats } from "./stats.ts";
import type { Match } from "./types.ts";

function match(partial: Partial<Match> & Pick<Match, "winnerName" | "loserName" | "playedAt">): Match {
  return {
    id: partial.id ?? "m",
    winnerId: partial.winnerId ?? "w",
    loserId: partial.loserId ?? "l",
    winnerName: partial.winnerName,
    loserName: partial.loserName,
    winnerScore: partial.winnerScore ?? 1,
    loserScore: partial.loserScore ?? 0,
    winnerRankBefore: 1,
    loserRankBefore: 2,
    swapped: false,
    stipAwarded: false,
    playedAt: partial.playedAt,
    note: "",
    challengeId: null,
  };
}

describe("pyramid stats", () => {
  it("counts matches per month and ignores a draw as a win", () => {
    const stats = pyramidStats(
      [{ name: "Tim", stippen: 2 }],
      [
        match({ winnerName: "Tim", loserName: "Bart", playedAt: "2026-10-02T12:00:00.000Z", winnerId: "t", loserId: "b" }),
        match({
          winnerName: "Tim",
          loserName: "Bart",
          winnerScore: 1,
          loserScore: 1,
          playedAt: "2026-10-09T12:00:00.000Z",
          winnerId: "t",
          loserId: "b",
        }),
      ],
      new Date("2026-10-23T12:00:00.000Z"),
    );
    const october = stats.months.find((row) => row.label.startsWith("okt"));
    assert.equal(october?.value, 2);
    assert.equal(stats.wins[0]?.label, "Tim");
    assert.equal(stats.wins[0]?.value, 1);
    assert.equal(stats.winShare.length, 1);
    assert.deepEqual(
      monthWinShare(
        [
          { winnerName: "Tim", loserName: "Bart", winnerScore: 2, loserScore: 0, playedAt: "2026-10-02T12:00:00.000Z" },
          { winnerName: "Bart", loserName: "Tim", winnerScore: 1, loserScore: 1, playedAt: "2026-10-03T12:00:00.000Z" },
          { winnerName: "Louis", loserName: "Tim", winnerScore: 2, loserScore: 1, playedAt: "2026-09-15T12:00:00.000Z" },
        ],
        new Date("2026-10-23T12:00:00.000Z"),
      ).map((row) => row.label),
      ["Tim"],
    );
    assert.equal(stats.stippen[0]?.value, 2);
  });

  it("keeps the newest result on the note", () => {
    const results = lastResults([
      match({ winnerName: "Tim", loserName: "Bart", playedAt: "2026-10-02T12:00:00.000Z", winnerId: "t", loserId: "b" }),
      match({
        id: "later",
        winnerName: "Bart",
        loserName: "Tim",
        playedAt: "2026-10-19T12:00:00.000Z",
        winnerId: "b",
        loserId: "t",
        winnerScore: 2,
        loserScore: 1,
      }),
    ]);
    assert.equal(results.get("b")?.line, "2–1 winst");
    assert.equal(results.get("t")?.line, "1–2 verlies");
  });

  it("counts wins in a row and clears the streak after a loss", () => {
    const matches = [
      match({ id: "1", winnerName: "Tim", loserName: "Bart", playedAt: "2026-10-01T12:00:00.000Z", winnerId: "t", loserId: "b" }),
      match({ id: "2", winnerName: "Tim", loserName: "Bart", playedAt: "2026-10-02T12:00:00.000Z", winnerId: "t", loserId: "b" }),
      match({
        id: "3",
        winnerName: "Tim",
        loserName: "Bart",
        winnerScore: 1,
        loserScore: 1,
        playedAt: "2026-10-03T12:00:00.000Z",
        winnerId: "t",
        loserId: "b",
      }),
      match({ id: "4", winnerName: "Bart", loserName: "Tim", playedAt: "2026-10-04T12:00:00.000Z", winnerId: "b", loserId: "t" }),
    ];
    const now = currentStreaks(matches);
    assert.equal(now.get("t"), 0);
    assert.equal(now.get("b"), 1);
    const stats = pyramidStats([], matches, new Date("2026-10-23T12:00:00.000Z"));
    assert.equal(stats.streaks[0]?.label, "Tim");
    assert.equal(stats.streaks[0]?.value, 2);
  });
});
