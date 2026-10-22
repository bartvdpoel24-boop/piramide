import { CHALLENGE_RANGE, type Player, type SettleResult, type Slot } from "./types.ts";

export function legalDistance(rankA: number, rankB: number, range = CHALLENGE_RANGE) {
  const distance = Math.abs(rankA - rankB);
  return distance >= 1 && distance <= range;
}

/** A challenge goes upward: the caller must stand below the target, within range. */
export function canChallengeUp(fromRank: number, targetRank: number, range = CHALLENGE_RANGE) {
  return targetRank < fromRank && fromRank - targetRank <= range;
}

export function settleMatch(
  players: Player[],
  leftId: string,
  rightId: string,
  leftScore: number,
  rightScore: number,
  range = CHALLENGE_RANGE,
): SettleResult {
  if (!Number.isInteger(leftScore) || !Number.isInteger(rightScore)) {
    throw new Error("Vul hele punten in.");
  }
  if (leftScore < 0 || rightScore < 0 || leftScore > 15 || rightScore > 15) {
    throw new Error("De score ligt tussen 0 en 15.");
  }
  if (leftId === rightId) throw new Error("Kies twee verschillende spelers.");

  const left = players.find((player) => player.id === leftId);
  const right = players.find((player) => player.id === rightId);
  if (!left || !right) throw new Error("Speler niet gevonden.");
  if (!legalDistance(left.rank, right.rank, range)) {
    throw new Error(`Alleen een partij binnen ${range} plaatsen telt voor de piramide.`);
  }

  if (leftScore === rightScore) {
    return {
      winnerId: left.id,
      loserId: right.id,
      winnerName: left.name,
      loserName: right.name,
      winnerScore: leftScore,
      loserScore: rightScore,
      winnerRankBefore: left.rank,
      loserRankBefore: right.rank,
      swapped: false,
      stipAwarded: false,
      draw: true,
      players: [...players].sort((a, b) => a.rank - b.rank),
    };
  }

  const leftWins = leftScore > rightScore;
  const winner = leftWins ? left : right;
  const loser = leftWins ? right : left;
  const swapped = winner.rank > loser.rank;
  const stipAwarded = !swapped && winner.rank === 1;

  const next = players
    .map((player) => {
      if (swapped && player.id === winner.id) return { ...player, rank: loser.rank };
      if (swapped && player.id === loser.id) return { ...player, rank: winner.rank };
      if (stipAwarded && player.id === winner.id) return { ...player, stippen: player.stippen + 1 };
      return player;
    })
    .sort((a, b) => a.rank - b.rank);

  return {
    winnerId: winner.id,
    loserId: loser.id,
    winnerName: winner.name,
    loserName: loser.name,
    winnerScore: leftWins ? leftScore : rightScore,
    loserScore: leftWins ? rightScore : leftScore,
    winnerRankBefore: winner.rank,
    loserRankBefore: loser.rank,
    swapped,
    stipAwarded,
    draw: false,
    players: next,
  };
}

export function nudgePlayer(players: Player[], id: string, direction: -1 | 1) {
  const me = players.find((player) => player.id === id);
  if (!me) throw new Error("Speler niet gevonden.");
  const other = players.find((player) => player.rank === me.rank + direction);
  if (!other) throw new Error(direction < 0 ? "Staat al bovenaan." : "Staat al onderaan.");
  return players
    .map((player) => {
      if (player.id === me.id) return { ...player, rank: other.rank };
      if (player.id === other.id) return { ...player, rank: me.rank };
      return player;
    })
    .sort((a, b) => a.rank - b.rank);
}

export function removePlayer(players: Player[], id: string) {
  const me = players.find((player) => player.id === id);
  if (!me) throw new Error("Speler niet gevonden.");
  if (players.length <= 1) throw new Error("De laatste speler blijft op de ladder.");
  return players
    .filter((player) => player.id !== id)
    .map((player) => (player.rank > me.rank ? { ...player, rank: player.rank - 1 } : player));
}

export function pyramidRows<T extends { rank: number }>(players: T[]) {
  const ordered = [...players].sort((a, b) => a.rank - b.rank);
  const rows: T[][] = [];
  let index = 0;
  let width = 1;
  while (index < ordered.length) {
    rows.push(ordered.slice(index, index + width));
    index += width;
    width += 1;
  }
  return rows;
}

export function normalizeSlots(slots: Slot[]) {
  if (slots.length > 28) throw new Error("Te veel tijdvensters.");
  const clean: Slot[] = [];
  for (const slot of slots) {
    const day = Number(slot.day);
    const startMin = Number(slot.startMin);
    const endMin = Number(slot.endMin);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error("Kies een geldige dag.");
    if (!Number.isInteger(startMin) || !Number.isInteger(endMin) || endMin - startMin < 30) {
      throw new Error("Een tijdvenster is minstens een half uur.");
    }
    if (startMin < 0 || endMin > 24 * 60) throw new Error("Tijd valt buiten de dag.");
    const sameDay = clean.filter((item) => item.day === day);
    if (sameDay.length >= 4) throw new Error("Hooguit vier tijden op één dag.");
    for (const other of sameDay) {
      if (Math.min(other.endMin, endMin) > Math.max(other.startMin, startMin)) {
        throw new Error("Tijden op dezelfde dag mogen niet overlappen.");
      }
    }
    clean.push({ day, startMin, endMin });
  }
  return clean.sort((a, b) => a.day - b.day || a.startMin - b.startMin);
}

export function overlapSlots(a: Slot[], b: Slot[]): Slot[] {
  const found: Slot[] = [];
  for (const left of a) {
    for (const right of b) {
      if (left.day !== right.day) continue;
      const startMin = Math.max(left.startMin, right.startMin);
      const endMin = Math.min(left.endMin, right.endMin);
      if (endMin - startMin >= 30) found.push({ day: left.day, startMin, endMin });
    }
  }
  return found;
}

export function cleanName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) {
    throw new Error("Een naam is 2 tot 40 tekens.");
  }
  return name;
}
