export const CHALLENGE_RANGE = 4;

export const NOTE_COLORS = [
  "ice",
  "sky",
  "butter",
  "blush",
  "coral",
  "cream",
  "lilac",
  "mint",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type Slot = {
  day: number;
  startMin: number;
  endMin: number;
};

export type Player = {
  id: string;
  name: string;
  rank: number;
  stippen: number;
  note: NoteColor;
  userId: string | null;
  email?: string;
  availability: Slot[];
  active?: boolean;
};

export type ChallengeStatus = "open" | "accepted" | "declined" | "played" | "cancelled" | "expired";

export type Challenge = {
  id: string;
  challengerId: string;
  defenderId: string;
  status: ChallengeStatus;
  kind: "challenge" | "invite";
  proposedDay: number | null;
  proposedStartMin: number | null;
  playOn: string | null;
  message: string;
  createdAt: string;
};

export type MatchSide = {
  id: string;
  name: string;
  score: number;
  rankBefore: number;
  rankAfter: number;
};

export type Match = {
  id: string;
  winnerId: string | null;
  loserId: string | null;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  winnerRankBefore: number;
  loserRankBefore: number;
  swapped: boolean;
  stipAwarded: boolean;
  playedAt: string;
  note: string;
  challengeId: string | null;
  sides?: MatchSide[];
};

export type LadderSnapshot = {
  id: string;
  name: string;
  inviteCode: string;
  challengeRange: number;
  amOwner: boolean;
  meId: string | null;
  players: Player[];
  challenges: Challenge[];
  matches: Match[];
};

export type LadderSummary = {
  id: string;
  name: string;
  inviteCode: string;
  myRank: number | null;
  myName: string | null;
  kingName: string | null;
  playerCount: number;
  openChallenges: number;
};

export type HomeChallenge = {
  id: string;
  ladderId: string;
  ladderName: string;
  challengerName: string;
  defenderName: string;
  status: ChallengeStatus;
  kind: "challenge" | "invite";
  createdAt: string;
};

export type HomeMatch = {
  id: string;
  ladderId: string;
  ladderName: string;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  winnerRankBefore: number;
  loserRankBefore: number;
  swapped: boolean;
  stipAwarded: boolean;
  playedAt: string;
  sides?: MatchSide[];
};

export type InvitePreview = {
  id: string;
  name: string;
  playerCount: number;
  alreadyIn: boolean;
  players: { id: string; name: string; rank: number; claimed: boolean }[];
};

export type SettleResult = {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  winnerRankBefore: number;
  loserRankBefore: number;
  swapped: boolean;
  stipAwarded: boolean;
  draw: boolean;
  players: Player[];
};
