import { fmtDay } from "./format.ts";
import type { Match } from "./types.ts";

export type LastResult = { date: string; line: string };

export type StatRow = { label: string; value: number; text: string };

export type PyramidStats = {
  months: StatRow[];
  wins: StatRow[];
  winShare: StatRow[];
  rates: StatRow[];
  stippen: StatRow[];
  played: number;
  rateNote: string;
};

function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).format(date);
  return parts.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "UTC" }).format(date);
}

function recentMonths(now = new Date(), count = 6) {
  const current = monthKey(now.toISOString());
  const [year, month] = current.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function currentMonthLabel(now = new Date()) {
  const key = monthKey(now.toISOString());
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function monthWinShare(
  matches: { winnerName: string; loserName: string; winnerScore: number; loserScore: number; playedAt: string }[],
  now = new Date(),
): StatRow[] {
  const current = monthKey(now.toISOString());
  const record = new Map<string, number>();
  for (const match of matches) {
    if (monthKey(match.playedAt) !== current) continue;
    if (match.winnerScore === match.loserScore) continue;
    const name = match.winnerName.trim();
    if (!name) continue;
    record.set(name, (record.get(name) ?? 0) + 1);
  }
  return [...record]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
    .map(([label, value]) => ({ label, value, text: String(value) }));
}

export function lastResults(matches: Match[]): Map<string, LastResult> {
  const found = new Map<string, { at: number; date: string; line: string }>();
  for (const match of matches) {
    const at = new Date(match.playedAt).getTime();
    if (Number.isNaN(at)) continue;
    const draw = match.sides && match.sides.length > 2
      ? match.sides.every((side) => side.score === match.sides![0]?.score)
      : match.winnerScore === match.loserScore;
    const sides = match.sides && match.sides.length > 2
      ? match.sides.map((side) => {
          const best = Math.max(...match.sides!.map((item) => item.score));
          const leaders = match.sides!.filter((item) => item.score === best).length;
          const won = !draw && side.score === best && leaders === 1;
          const line = won ? `${side.score} winst` : draw ? `${side.score} gelijk` : `${side.score} punten`;
          return { id: side.id, line };
        })
      : [
          { id: match.winnerId, line: draw ? `${match.winnerScore}–${match.loserScore} gelijk` : `${match.winnerScore}–${match.loserScore} winst` },
          { id: match.loserId, line: draw ? `${match.winnerScore}–${match.loserScore} gelijk` : `${match.loserScore}–${match.winnerScore} verlies` },
        ];
    for (const side of sides) {
      if (!side.id) continue;
      const prev = found.get(side.id);
      if (prev && prev.at >= at) continue;
      found.set(side.id, { at, date: fmtDay(match.playedAt), line: side.line });
    }
  }
  return new Map([...found].map(([id, row]) => [id, { date: row.date, line: row.line }]));
}

export function pyramidStats(
  players: { name: string; stippen: number }[],
  matches: Match[],
  now = new Date(),
): PyramidStats {
  const byMonth = new Map<string, number>();
  const record = new Map<string, { wins: number; played: number }>();
  const touch = (name: string) => {
    const key = name.trim();
    if (!key) return null;
    const row = record.get(key) ?? { wins: 0, played: 0 };
    record.set(key, row);
    return row;
  };

  for (const match of matches) {
    const key = monthKey(match.playedAt);
    if (key) byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    const draw = match.winnerScore === match.loserScore;
    const winner = touch(match.winnerName);
    const loser = touch(match.loserName);
    if (winner) {
      winner.played += 1;
      if (!draw) winner.wins += 1;
    }
    if (loser) loser.played += 1;
  }

  const months = recentMonths(now).map((key) => {
    const value = byMonth.get(key) ?? 0;
    return { label: monthLabel(key), value, text: String(value) };
  });

  const winShare = [...record]
    .filter(([, row]) => row.wins > 0)
    .sort((a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0], "nl"))
    .map(([label, row]) => ({ label, value: row.wins, text: String(row.wins) }));

  const wins = winShare.slice(0, 8);

  const seasoned = [...record].filter(([, row]) => row.played >= 3);
  const pool = seasoned.length > 0 ? seasoned : [...record].filter(([, row]) => row.played > 0);
  const rates = pool
    .sort((a, b) => b[1].wins / b[1].played - a[1].wins / a[1].played || b[1].wins - a[1].wins || a[0].localeCompare(b[0], "nl"))
    .slice(0, 8)
    .map(([label, row]) => ({
      label,
      value: Math.round((row.wins / row.played) * 100),
      text: `${row.wins} van ${row.played}`,
    }));

  const stippen = players
    .filter((player) => player.stippen > 0)
    .sort((a, b) => b.stippen - a.stippen || a.name.localeCompare(b.name, "nl"))
    .slice(0, 8)
    .map((player) => ({ label: player.name, value: player.stippen, text: String(player.stippen) }));

  return {
    months,
    wins,
    winShare,
    rates,
    stippen,
    played: matches.length,
    rateNote: seasoned.length > 0 ? "Alleen wie minstens 3 partijen speelde." : "Nog te weinig partijen voor een eerlijke vergelijking.",
  };
}
