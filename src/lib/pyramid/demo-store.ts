import { create } from "zustand";
import { persist } from "zustand/middleware";
import { canChallengeUp, cleanName, nudgePlayer, removePlayer, settleMatch } from "./rules";
import { freshDemo, noteForIndex, type DemoState } from "./roster";
import { CHALLENGE_RANGE, type SettleResult, type Slot } from "./types";

type DemoActions = {
  setPersona: (id: string) => void;
  reset: () => void;
  setAvailability: (slots: Slot[]) => void;
  challenge: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
  }) => void;
  respond: (id: string, action: "accept" | "decline" | "cancel") => void;
  record: (input: {
    leftId: string;
    rightId: string;
    leftScore: number;
    rightScore: number;
    note: string;
    challengeId?: string | null;
  }) => SettleResult;
  nudge: (playerId: string, direction: -1 | 1) => void;
  remove: (playerId: string) => void;
  add: (name: string) => void;
};

export const useDemoStore = create<DemoState & DemoActions>()(
  persist(
    (set, get) => ({
      ...freshDemo(),
      setPersona: (id) => set({ personaId: id }),
      reset: () => set(freshDemo()),
      setAvailability: (slots) => {
        const me = get().personaId;
        set({
          players: get().players.map((player) =>
            player.id === me ? { ...player, availability: slots } : player,
          ),
        });
      },
      challenge: ({ defenderId, day, startMin, message }) => {
        const { players, personaId, challenges } = get();
        const me = players.find((player) => player.id === personaId);
        const defender = players.find((player) => player.id === defenderId);
        if (!me || !defender) throw new Error("Speler niet gevonden.");
        if (!canChallengeUp(me.rank, defender.rank, CHALLENGE_RANGE)) {
          throw new Error(`Je kunt alleen iemand tot ${CHALLENGE_RANGE} plaatsen boven je uitdagen.`);
        }
        const pending = challenges.some(
          (item) =>
            (item.status === "open" || item.status === "accepted") &&
            ((item.challengerId === me.id && item.defenderId === defender.id) ||
              (item.challengerId === defender.id && item.defenderId === me.id)),
        );
        if (pending) throw new Error("Er staat al een open uitdaging tussen jullie.");
        set({
          challenges: [
            {
              id: crypto.randomUUID(),
              challengerId: me.id,
              defenderId: defender.id,
              status: "open",
              proposedDay: day,
              proposedStartMin: startMin,
              message: message.slice(0, 140),
              createdAt: new Date().toISOString(),
            },
            ...challenges,
          ],
        });
      },
      respond: (id, action) => {
        const challenge = get().challenges.find((item) => item.id === id);
        if (!challenge) throw new Error("Uitdaging niet gevonden.");
        const me = get().personaId;
        if (action === "cancel" && challenge.challengerId !== me) {
          throw new Error("Alleen de uitdager trekt dit in.");
        }
        if (action !== "cancel" && challenge.defenderId !== me) {
          throw new Error("Je kunt alleen een uitdaging accepteren of afwijzen die voor jou is.");
        }
        if (challenge.status !== "open" && !(action === "cancel" && challenge.status === "accepted")) {
          throw new Error("Deze uitdaging is al afgerond.");
        }
        const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
        set({
          challenges: get().challenges.map((item) => (item.id === id ? { ...item, status } : item)),
        });
      },
      record: ({ leftId, rightId, leftScore, rightScore, note, challengeId }) => {
        const settled = settleMatch(get().players, leftId, rightId, leftScore, rightScore);
        const matchId = crypto.randomUUID();
        set({
          players: settled.players,
          matches: [
            {
              id: matchId,
              winnerId: settled.winnerId,
              loserId: settled.loserId,
              winnerName: settled.winnerName,
              loserName: settled.loserName,
              winnerScore: settled.winnerScore,
              loserScore: settled.loserScore,
              winnerRankBefore: settled.winnerRankBefore,
              loserRankBefore: settled.loserRankBefore,
              swapped: settled.swapped,
              stipAwarded: settled.stipAwarded,
              playedAt: new Date().toISOString(),
              note: note.slice(0, 140),
              challengeId: challengeId ?? null,
            },
            ...get().matches,
          ],
          challenges: get().challenges.map((item) =>
            item.id === challengeId ? { ...item, status: "played" } : item,
          ),
        });
        return settled;
      },
      nudge: (playerId, direction) => set({ players: nudgePlayer(get().players, playerId, direction) }),
      remove: (playerId) => {
        const players = removePlayer(get().players, playerId);
        const personaId = players.some((player) => player.id === get().personaId)
          ? get().personaId
          : (players[0]?.id ?? get().personaId);
        set({
          players,
          personaId,
          challenges: get().challenges.map((item) =>
            item.challengerId === playerId || item.defenderId === playerId
              ? { ...item, status: item.status === "played" ? "played" : "cancelled" }
              : item,
          ),
        });
      },
      add: (name) => {
        const clean = cleanName(name);
        const players = get().players;
        if (players.some((player) => player.name.toLowerCase() === clean.toLowerCase())) {
          throw new Error("Die naam staat al op de ladder.");
        }
        set({
          players: [
            ...players,
            {
              id: crypto.randomUUID(),
              name: clean,
              rank: players.length + 1,
              stippen: 0,
              note: noteForIndex(players.length),
              userId: null,
              availability: [],
            },
          ],
        });
      },
    }),
    { name: "piramide-demo-v1", version: 1 },
  ),
);
