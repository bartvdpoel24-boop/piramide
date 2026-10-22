import type { Challenge, Match, NoteColor, Player, Slot } from "./types";

export const WALL: { id: string; name: string; note: NoteColor }[] = [
  { id: "p-tim", name: "Tim", note: "sky" },
  { id: "p-bart", name: "Bart van der Poel", note: "sky" },
  { id: "p-louis", name: "Louis", note: "sky" },
  { id: "p-ingmar", name: "Ingmar", note: "butter" },
  { id: "p-nynke", name: "Nynke", note: "ice" },
  { id: "p-munish", name: "Munish", note: "cream" },
  { id: "p-lars", name: "Lars", note: "cream" },
  { id: "p-luukj", name: "Luuk J.", note: "cream" },
  { id: "p-wouter", name: "Wouter", note: "lilac" },
  { id: "p-geert", name: "Geert", note: "sky" },
  { id: "p-william", name: "William", note: "cream" },
  { id: "p-sophie", name: "Sophie", note: "coral" },
  { id: "p-danny", name: "Danny", note: "cream" },
  { id: "p-michielj", name: "Michiel J.", note: "cream" },
  { id: "p-rene", name: "René", note: "cream" },
  { id: "p-sam", name: "Sam 2", note: "cream" },
  { id: "p-emma", name: "Emma", note: "blush" },
  { id: "p-ludo", name: "Ludo", note: "blush" },
  { id: "p-luukv", name: "Luuk V.", note: "sky" },
  { id: "p-michield", name: "Michiel D.", note: "cream" },
  { id: "p-jamie", name: "Jamie", note: "sky" },
  { id: "p-fabian", name: "Fabian", note: "ice" },
  { id: "p-robin", name: "Robin B.", note: "blush" },
  { id: "p-jens", name: "Jens", note: "sky" },
  { id: "p-ton", name: "Ton", note: "blush" },
  { id: "p-nico", name: "Nico", note: "ice" },
  { id: "p-paul", name: "Paul", note: "ice" },
];

const DEMO_JOINED = new Set(["p-tim", "p-bart", "p-louis", "p-nynke", "p-sophie", "p-geert"]);

export function withDemoSignups(players: Player[]): Player[] {
  return players.map((player) =>
    DEMO_JOINED.has(player.id) && !player.userId ? { ...player, userId: `demo:${player.id}` } : player,
  );
}

function slot(day: number, startHour: number, endHour: number, endMin = 0): Slot {
  return { day, startMin: startHour * 60, endMin: endHour * 60 + endMin };
}

export function wallPlayers(): Player[] {
  const availability = new Map<string, Slot[]>([
    ["p-tim", [slot(1, 12, 13, 30), slot(3, 16, 17, 30)]],
    ["p-bart", [slot(1, 12, 13), slot(3, 12, 13), slot(4, 16, 17)]],
    ["p-louis", [0, 1, 2, 3, 4].map((day) => slot(day, 12, 13))],
    ["p-nynke", [slot(2, 12, 14)]],
    ["p-sophie", [slot(1, 16, 18), slot(4, 12, 13)]],
    ["p-geert", [slot(0, 12, 13), slot(2, 16, 18)]],
  ]);
  return WALL.map((person, index) => ({
    id: person.id,
    name: person.name,
    rank: index + 1,
    stippen: person.id === "p-tim" ? 1 : 0,
    note: person.note,
    userId: DEMO_JOINED.has(person.id) ? `demo:${person.id}` : null,
    availability: availability.get(person.id) ?? [],
  }));
}

export type DemoState = {
  players: Player[];
  challenges: Challenge[];
  matches: Match[];
  personaId: string;
};

export function freshDemo(): DemoState {
  const playedAt = new Date();
  playedAt.setDate(playedAt.getDate() - 4);
  playedAt.setHours(12, 20, 0, 0);
  const match: Match = {
    id: "m-sample-troon",
    winnerId: "p-tim",
    loserId: "p-bart",
    winnerName: "Tim",
    loserName: "Bart van der Poel",
    winnerScore: 1,
    loserScore: 0,
    winnerRankBefore: 1,
    loserRankBefore: 2,
    swapped: false,
    stipAwarded: true,
    playedAt: playedAt.toISOString(),
    note: "Voorbeeld, nog geen echte partij.",
    challengeId: null,
  };
  return {
    players: wallPlayers(),
    challenges: [],
    matches: [match],
    personaId: "p-bart",
  };
}

export function noteForIndex(index: number): NoteColor {
  const colors: NoteColor[] = ["ice", "butter", "blush", "cream", "sky", "coral", "lilac", "mint"];
  return colors[index % colors.length] ?? "cream";
}
