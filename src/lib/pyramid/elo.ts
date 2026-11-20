import type { Match } from "./types";

export const ELO_START = 1200;
export const ELO_K = 32;

export function expectedScore(rating: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

function sidesOf(match: Match) {
  if (match.sides && match.sides.length >= 2) {
    return match.sides.filter((side) => side.id).map((side) => ({ id: side.id, score: side.score }));
  }
  if (!match.winnerId || !match.loserId) return null;
  return [
    { id: match.winnerId, score: match.winnerScore },
    { id: match.loserId, score: match.loserScore },
  ];
}

/** Elo uit alle uitslagen, op datum. Iedereen begint op ELO_START. */
export function eloRatings(playerIds: string[], matches: Match[]) {
  return walkElo(playerIds, matches).ratings;
}

/** Ratingverschil per partij, na afronding. Zelfde berekening als de Elo zelf. */
export function eloDeltas(matches: Match[]) {
  return walkElo([], matches).deltas;
}

export function fmtEloDelta(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

function walkElo(playerIds: string[], matches: Match[]) {
  const ratings = new Map<string, number>();
  for (const id of playerIds) ratings.set(id, ELO_START);
  const deltas = new Map<string, Map<string, number>>();

  const ordered = [...matches]
    .filter((match) => !Number.isNaN(new Date(match.playedAt).getTime()))
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime() || a.id.localeCompare(b.id));

  for (const match of ordered) {
    const sides = sidesOf(match);
    if (!sides || sides.length < 2) continue;
    for (const side of sides) {
      if (!ratings.has(side.id)) ratings.set(side.id, ELO_START);
    }
    const k = ELO_K / (sides.length - 1);
    const delta = new Map<string, number>();
    for (let i = 0; i < sides.length; i += 1) {
      for (let j = i + 1; j < sides.length; j += 1) {
        const left = sides[i]!;
        const right = sides[j]!;
        const actual = left.score > right.score ? 1 : left.score < right.score ? 0 : 0.5;
        const expected = expectedScore(ratings.get(left.id)!, ratings.get(right.id)!);
        delta.set(left.id, (delta.get(left.id) ?? 0) + k * (actual - expected));
        delta.set(right.id, (delta.get(right.id) ?? 0) + k * (expected - actual));
      }
    }
    const applied = new Map<string, number>();
    for (const [id, change] of delta) {
      const before = ratings.get(id) ?? ELO_START;
      const next = Math.round(before + change);
      ratings.set(id, next);
      applied.set(id, next - before);
    }
    deltas.set(match.id, applied);
  }

  return { ratings, deltas };
}
