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

export function amsterdamDate(instant: Date | string = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function amsterdamTime(instant: Date | string = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return "12:00";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "12").replace("24", "00");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function amsterdamInstant(day: string, time: string) {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, date, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const zoned = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
  return new Date(utc.getTime() - (zoned - utc.getTime()));
}

/** Datum en tijd in Amsterdam. Zonder tijd geldt het huidige tijdstip. */
export function playedAtFromDay(day: string | null | undefined, time?: string | null) {
  const today = amsterdamDate();
  const value = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
  if (value > today) throw new Error("De wedstrijd kan niet in de toekomst liggen.");
  const clock = typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : amsterdamTime();
  const at = amsterdamInstant(value, clock);
  if (Number.isNaN(at.getTime())) return new Date().toISOString();
  if (at.getTime() > Date.now() + 60_000) throw new Error("De wedstrijd kan niet in de toekomst liggen.");
  return at.toISOString();
}

/** Placeholder-middag (12:00) wordt het tijdstip waarop de uitslag is ingevoerd. */
export function repairPlayedAt(playedAt: string, createdAt?: string | null) {
  if (!createdAt || amsterdamTime(playedAt) !== "12:00") return playedAt;
  const entered = amsterdamTime(createdAt);
  if (entered === "12:00") return playedAt;
  try {
    return playedAtFromDay(amsterdamDate(playedAt), entered);
  } catch {
    return playedAt;
  }
}

export function shiftDate(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  const utc = new Date(Date.UTC(year, month - 1, date));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function fmtPlainDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function isChallengeExpired(
  challenge: { status: string; playOn?: string | null; createdAt: string },
  now = new Date(),
) {
  if (challenge.status !== "open" && challenge.status !== "accepted") return false;
  const today = amsterdamDate(now);
  const start = challenge.playOn && /^\d{4}-\d{2}-\d{2}$/.test(challenge.playOn)
    ? challenge.playOn
    : amsterdamDate(challenge.createdAt);
  if (!start || !today) return false;
  return start <= shiftDate(today, -5);
}

export function challengeWhen(
  challenge: Pick<Challenge, "proposedDay" | "proposedStartMin"> & { playOn?: string | null; createdAt?: string },
) {
  const when =
    challenge.proposedDay == null || challenge.proposedStartMin == null
      ? "tijdstip nog open"
      : `${DAYS_LONG[challenge.proposedDay]} ${fmtMin(challenge.proposedStartMin)}`;
  const day = challenge.playOn
    ? fmtPlainDate(challenge.playOn)
    : challenge.createdAt
      ? fmtDay(challenge.createdAt)
      : "";
  return day ? `${day} · ${when}` : when;
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
