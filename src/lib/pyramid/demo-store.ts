import { create } from "zustand";
import { persist } from "zustand/middleware";
import { canChallengeUp, canInviteDown, cleanName, isPyramidAdmin, nudgePlayer, parkPlayer, restorePlayer, reviseMatch, sameOutcome, settleMatch } from "./rules";
import { cleanEmail } from "./email";
import { freshDemo, noteForIndex, withDemoSignups, type DemoState } from "./roster";
import { CHALLENGE_RANGE, type NoteColor, type SettleResult, type Slot } from "./types";

type DemoActions = {
  setPersona: (id: string) => void;
  reset: () => void;
  setAvailability: (slots: Slot[]) => void;
  challenge: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
    kind: "challenge" | "invite";
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
  restore: (playerId: string) => void;
  revise: (matchId: string, winnerScore: number, loserScore: number, note: string) => SettleResult;
  add: (name: string) => void;
  rename: (name: string) => void;
  setEmail: (email: string) => void;
  setNote: (color: NoteColor) => void;
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
      challenge: ({ defenderId, day, startMin, message, kind }) => {
        const { players, personaId, challenges } = get();
        const me = players.find((player) => player.id === personaId);
        const defender = players.find((player) => player.id === defenderId);
        if (!me || !defender) throw new Error("Speler niet gevonden.");
        const allowed = kind === "invite"
          ? canInviteDown(me.rank, defender.rank, CHALLENGE_RANGE)
          : canChallengeUp(me.rank, defender.rank, CHALLENGE_RANGE);
        if (!allowed) {
          throw new Error(
            kind === "invite"
              ? `Je kunt iemand tot ${CHALLENGE_RANGE} plaatsen onder je uitnodigen.`
              : `Je kunt alleen iemand tot ${CHALLENGE_RANGE} plaatsen boven je uitdagen.`,
          );
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
              kind,
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
        const persona = get().players.find((player) => player.id === get().personaId);
        if (!isPyramidAdmin(persona)) throw new Error("Alleen Bart van der Poel haalt iemand van de ladder.");
        const players = parkPlayer(get().players, playerId);
        set({
          players,
          challenges: get().challenges.map((item) =>
            (item.challengerId === playerId || item.defenderId === playerId) && item.status !== "played"
              ? { ...item, status: "cancelled" }
              : item,
          ),
        });
      },
      restore: (playerId) => {
        const persona = get().players.find((player) => player.id === get().personaId);
        if (!isPyramidAdmin(persona)) throw new Error("Alleen Bart van der Poel zet een briefje terug.");
        set({ players: restorePlayer(get().players, playerId) });
      },
      revise: (matchId, winnerScore, loserScore, note) => {
        const persona = get().players.find((player) => player.id === get().personaId);
        const match = get().matches.find((item) => item.id === matchId);
        if (!match) throw new Error("Uitslag niet gevonden.");
        const played = match.winnerId === get().personaId || match.loserId === get().personaId;
        if (!played && !isPyramidAdmin(persona)) throw new Error("Alleen de spelers of Bart kunnen deze score wijzigen.");
        if (sameOutcome(match.winnerScore, match.loserScore, winnerScore, loserScore)) {
          set({
            matches: get().matches.map((item) =>
              item.id === matchId ? { ...item, winnerScore, loserScore, note: note.slice(0, 140) } : item,
            ),
          });
          return {
            winnerId: match.winnerId ?? "",
            loserId: match.loserId ?? "",
            winnerName: match.winnerName,
            loserName: match.loserName,
            winnerScore,
            loserScore,
            winnerRankBefore: match.winnerRankBefore,
            loserRankBefore: match.loserRankBefore,
            swapped: false,
            stipAwarded: false,
            draw: winnerScore === loserScore,
            players: get().players,
          };
        }
        const settled = reviseMatch(get().players, match, winnerScore, loserScore);
        set({
          players: settled.players,
          matches: get().matches.map((item) =>
            item.id === matchId
              ? {
                  ...item,
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
                  note: note.slice(0, 140),
                }
              : item,
          ),
        });
        return settled;
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
              email: "",
              availability: [],
            },
          ],
        });
      },
      rename: (name) => {
        const clean = cleanName(name);
        const { players, personaId } = get();
        if (!players.some((player) => player.id === personaId)) throw new Error("Speler niet gevonden.");
        if (players.some((player) => player.id !== personaId && player.name.toLowerCase() === clean.toLowerCase())) {
          throw new Error("Die naam staat al op de ladder.");
        }
        set({
          players: players.map((player) => (player.id === personaId ? { ...player, name: clean } : player)),
        });
      },
      setEmail: (email) => {
        const clean = cleanEmail(email);
        const { players, personaId } = get();
        if (!players.some((player) => player.id === personaId)) throw new Error("Speler niet gevonden.");
        set({
          players: players.map((player) => (player.id === personaId ? { ...player, email: clean } : player)),
        });
      },
      setNote: (color) => {
        const { players, personaId } = get();
        if (!players.some((player) => player.id === personaId)) throw new Error("Speler niet gevonden.");
        set({
          players: players.map((player) => (player.id === personaId ? { ...player, note: color } : player)),
        });
      },
    }),
    { name: "piramide-demo-v1", version: 3, migrate: (persisted) => {
      if (!persisted || typeof persisted !== "object") return freshDemo();
      const state = persisted as DemoState;
      if (!Array.isArray(state.players)) return freshDemo();
      return {
        ...state,
        players: withDemoSignups(state.players).map((player) => ({ ...player, email: player.email ?? "" })),
      };
    } },
  ),
);
