import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cleanName, friendlyResult, isOnWall, isPyramidAdmin, nudgePlayer, parkPlayer, restorePlayer, reviseMatch, sameOutcome, scoreMatch, settleGroup } from "./rules";
import { cleanEmail } from "./email";
import { isChallengeExpired, playedAtFromDay, repairPlayedAt } from "./format";
import { freshDemo, noteForIndex, withDemoSignups, type DemoState } from "./roster";
import { type Challenge, type Match, type NoteColor, type SettleResult, type Slot } from "./types";
import type { Player } from "./types";

type DemoActions = {
  setPersona: (id: string) => void;
  reset: () => void;
  setAvailability: (slots: Slot[]) => void;
  challenge: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
    kind: "challenge" | "invite" | "friendly";
    playOn?: string | null;
  }) => void;
  respond: (id: string, action: "accept" | "decline" | "cancel") => void;
  record: (input: {
    leftId: string;
    rightId: string;
    leftScore: number;
    rightScore: number;
    note: string;
    challengeId?: string | null;
    playedOn?: string | null;
    playedTime?: string | null;
  }) => SettleResult;
  recordGroup: (input: { sides: { id: string; score: number }[]; note: string; playedOn?: string | null; playedTime?: string | null }) => SettleResult;
  nudge: (playerId: string, direction: -1 | 1) => void;
  remove: (playerId: string) => void;
  restore: (playerId: string) => void;
  revise: (matchId: string, winnerScore: number, loserScore: number, note: string, playedOn?: string | null, playedTime?: string | null, asOwner?: boolean) => SettleResult;
  removeMatch: (matchId: string) => void;
  add: (name: string) => void;
  rename: (name: string) => void;
  setEmail: (email: string) => void;
  setNote: (color: NoteColor) => void;
  loadBackup: (input: { players: Player[]; challenges: Challenge[]; matches: Match[]; personaId: string }) => void;
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
      challenge: ({ defenderId, day, startMin, message, kind, playOn }) => {
        const { players, personaId } = get();
        const challenges = get().challenges.map((item) =>
          isChallengeExpired(item) ? { ...item, status: "expired" as const } : item,
        );
        const me = players.find((player) => player.id === personaId);
        const defender = players.find((player) => player.id === defenderId);
        if (!me || !defender) throw new Error("Speler niet gevonden.");
        if (me.id === defender.id) throw new Error("Je kunt jezelf niet uitdagen.");
        if (!isOnWall(me) || !isOnWall(defender)) throw new Error("Die speler hangt niet op de piramide.");
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
              playOn: playOn && /^\d{4}-\d{2}-\d{2}$/.test(playOn) ? playOn : null,
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
      record: ({ leftId, rightId, leftScore, rightScore, note, challengeId, playedOn, playedTime }) => {
        const challenge = get().challenges.find((item) => item.id === challengeId);
        const settled = challenge?.kind === "friendly"
          ? friendlyResult(get().players, leftId, rightId, leftScore, rightScore)
          : scoreMatch(get().players, leftId, rightId, leftScore, rightScore);
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
              playedAt: playedAtFromDay(playedOn, playedTime),
              createdAt: new Date().toISOString(),
              recordedBy: get().players.find((player) => player.id === get().personaId)?.userId ?? get().personaId,
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
      recordGroup: ({ sides, note, playedOn, playedTime }) => {
        const persona = get().players.find((player) => player.id === get().personaId);
        const involved = sides.some((side) => side.id === get().personaId);
        if (!involved && !isPyramidAdmin(persona)) {
          throw new Error("Alleen wie meedeed of de beheerder vult de uitslag in.");
        }
        const settled = settleGroup(get().players, sides);
        const top = settled.places[0];
        const bottom = settled.places[settled.places.length - 1];
        if (!top || !bottom) throw new Error("Kies minstens twee spelers.");
        const sharedTop = settled.places.filter((place) => place.score === top.score).length > 1;
        set({
          players: settled.players,
          matches: [
            {
              id: crypto.randomUUID(),
              winnerId: top.id,
              loserId: bottom.id,
              winnerName: top.name,
              loserName: bottom.name,
              winnerScore: top.score,
              loserScore: sharedTop ? top.score : bottom.score,
              winnerRankBefore: top.rankBefore,
              loserRankBefore: bottom.rankBefore,
              swapped: settled.swapped,
              stipAwarded: settled.stipAwarded,
              playedAt: playedAtFromDay(playedOn, playedTime),
              createdAt: new Date().toISOString(),
              recordedBy: persona?.userId ?? get().personaId,
              note: note.slice(0, 140),
              challengeId: null,
              sides: settled.places,
            },
            ...get().matches,
          ],
        });
        return {
          winnerId: top.id,
          loserId: bottom.id,
          winnerName: top.name,
          loserName: bottom.name,
          winnerScore: top.score,
          loserScore: sharedTop ? top.score : bottom.score,
          winnerRankBefore: top.rankBefore,
          loserRankBefore: bottom.rankBefore,
          swapped: settled.swapped,
          stipAwarded: settled.stipAwarded,
          draw: settled.draw,
          players: settled.players,
        };
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
      revise: (matchId, winnerScore, loserScore, note, playedOn, playedTime, asOwner = false) => {
        const persona = get().players.find((player) => player.id === get().personaId);
        const match = get().matches.find((item) => item.id === matchId);
        if (!match) throw new Error("Uitslag niet gevonden.");
        const played = match.winnerId === get().personaId || match.loserId === get().personaId;
        if (!played && !isPyramidAdmin(persona) && !asOwner && match.recordedBy !== (persona?.userId ?? get().personaId)) {
          throw new Error("Alleen de beheerder, de aanmaker of de spelers kunnen deze score wijzigen.");
        }
        if (sameOutcome(match.winnerScore, match.loserScore, winnerScore, loserScore)) {
          set({
            matches: get().matches.map((item) =>
              item.id === matchId ? { ...item, winnerScore, loserScore, note: note.slice(0, 140), playedAt: playedAtFromDay(playedOn, playedTime) } : item,
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
                  playedAt: playedAtFromDay(playedOn, playedTime),
                }
              : item,
          ),
        });
        return settled;
      },
      removeMatch: (matchId) => {
        const persona = get().players.find((player) => player.id === get().personaId);
        if (!isPyramidAdmin(persona)) throw new Error("Alleen Bart van der Poel kan een uitslag verwijderen.");
        const match = get().matches.find((item) => item.id === matchId);
        if (!match) throw new Error("Uitslag niet gevonden.");
        let players = get().players.map((player) => ({ ...player }));
        if (match.stipAwarded && match.winnerId) {
          players = players.map((player) =>
            player.id === match.winnerId ? { ...player, stippen: Math.max(0, player.stippen - 1) } : player,
          );
        }
        const group = match.sides && match.sides.length > 2 ? match.sides : null;
        if (group) {
          const canRestore = group.every((side) => players.find((player) => player.id === side.id)?.rank === side.rankAfter);
          if (canRestore) {
            players = players.map((player) => {
              const side = group.find((item) => item.id === player.id);
              return side ? { ...player, rank: side.rankBefore } : player;
            });
          }
        } else if (match.swapped && match.winnerId && match.loserId) {
          const winner = players.find((player) => player.id === match.winnerId);
          const loser = players.find((player) => player.id === match.loserId);
          if (winner && loser && winner.rank === match.loserRankBefore && loser.rank === match.winnerRankBefore) {
            players = players.map((player) => {
              if (player.id === winner.id) return { ...player, rank: loser.rank };
              if (player.id === loser.id) return { ...player, rank: winner.rank };
              return player;
            });
          }
        }
        set({
          players,
          matches: get().matches.filter((item) => item.id !== matchId),
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
      loadBackup: ({ players, challenges, matches, personaId }) => {
        if (!Array.isArray(players) || players.length === 0) throw new Error("Dit is geen piramide-backup.");
        const nextPersona = players.some((player) => player.id === personaId) ? personaId : players[0]!.id;
        set({
          players,
          challenges: Array.isArray(challenges) ? challenges : [],
          matches: Array.isArray(matches) ? matches : [],
          personaId: nextPersona,
        });
      },
    }),
    { name: "piramide-demo-v1", version: 4, migrate: (persisted) => {
      if (!persisted || typeof persisted !== "object") return freshDemo();
      const state = persisted as DemoState;
      if (!Array.isArray(state.players)) return freshDemo();
      return {
        ...state,
        players: withDemoSignups(state.players).map((player) => ({ ...player, email: player.email ?? "" })),
        matches: Array.isArray(state.matches)
          ? state.matches.map((match) => ({ ...match, playedAt: repairPlayedAt(match.playedAt, match.createdAt) }))
          : [],
      };
    } },
  ),
);
