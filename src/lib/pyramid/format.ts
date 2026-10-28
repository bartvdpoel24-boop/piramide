import type { Challenge, Match, Slot } from "./types.ts";

export const DAYS_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;
export const DAYS_LONG = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
] as const;

export function fmtMin(mins: number) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function fmtSlot(slot: Slot) {
  const day = DAYS_LONG[slot.day] ?? "dag";
  return `${day} ${fmtMin(slot.startMin)}–${fmtMin(slot.endMin)}`;
}

export function fmtDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

export function fmtWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

export function todayDayIndex(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "Europe/Amsterdam",
  }).format(now);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday] ?? 0;
}

export function challengeWhen(challenge: Pick<Challenge, "proposedDay" | "proposedStartMin">) {
  if (challenge.proposedDay == null || challenge.proposedStartMin == null) return "tijdstip nog open";
  return `${DAYS_LONG[challenge.proposedDay]} ${fmtMin(challenge.proposedStartMin)}`;
}

export function matchSummary(match: Match) {
  if (match.sides && match.sides.length > 2) {
    const score = match.sides.map((side) => `${side.name} ${side.score}`).join(", ");
    const moved = match.sides.filter((side) => side.rankBefore !== side.rankAfter);
    if (moved.length === 0) return `${score}. De briefjes blijven hangen.`;
    const shifts = moved.map((side) => `${side.name} naar plek ${side.rankAfter}`).join(", ");
    return `${score}. ${shifts}. Briefjes ertussen blijven hangen.`;
  }
  const score = `${match.winnerScore}–${match.loserScore}`;
  if (match.winnerScore === match.loserScore) {
    return `${match.winnerName} en ${match.loserName} speelden gelijk (${score}). De briefjes blijven hangen.`;
  }
  if (match.swapped) {
    return `${match.winnerName} won van ${match.loserName} (${score}) en pakte plek ${match.loserRankBefore}.`;
  }
  if (match.stipAwarded) {
    return `${match.winnerName} verdedigde de troon tegen ${match.loserName} (${score}). +1 stip.`;
  }
  return `${match.winnerName} won van ${match.loserName} (${score}). De piramide blijft staan.`;
}

export const TIME_OPTIONS = Array.from({ length: 27 }, (_, index) => 8 * 60 + index * 30);
