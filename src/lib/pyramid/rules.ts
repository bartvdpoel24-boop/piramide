import { CHALLENGE_RANGE, type Player, type SettleResult, type Slot } from "./types.ts";

export function legalDistance(rankA: number, rankB: number, range = CHALLENGE_RANGE) {
  const distance = Math.abs(rankA - rankB);
  return distance >= 1 && distance <= range;
}

/** A challenge goes upward: the caller must stand below the target, within range. */
export function canChallengeUp(fromRank: number, targetRank: number, range = CHALLENGE_RANGE) {
  return targetRank < fromRank && fromRank - targetRank <= range;
}

/** An invitation goes downward, within the same range, so the match still counts. */
export function canInviteDown(fromRank: number, targetRank: number, range = CHALLENGE_RANGE) {
  return targetRank > fromRank && targetRank - fromRank <= range;
}

const ADMIN_NAME = "bart van der poel";

/** The office admin is Bart van der Poel. The demo card keeps that role after a rename. */
export function isPyramidAdmin(player: { id: string; name: string } | null | undefined) {
  if (!player) return false;
  if (player.id === "p-bart") return true;
  return player.name.replace(/\s+/g, " ").trim().toLowerCase() === ADMIN_NAME;
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

export function isOnWall(player: { active?: boolean }) {
  return player.active !== false;
}

export function parkPlayer(players: Player[], id: string) {
  const me = players.find((player) => player.id === id);
  if (!me || !isOnWall(me)) throw new Error("Speler niet gevonden.");
  const staying = players.filter((player) => player.id !== id && isOnWall(player));
  if (staying.length < 1) throw new Error("De laatste speler blijft op de ladder.");
  const ordered = [...staying].sort((a, b) => a.rank - b.rank).map((player, index) => ({ ...player, rank: index + 1 }));
  const byId = new Map(ordered.map((player) => [player.id, player]));
  const parkedRank = Math.min(0, ...players.map((player) => player.rank)) - 1;
  return players.map((player) => {
    if (player.id === id) return { ...player, active: false, rank: parkedRank };
    return byId.get(player.id) ?? player;
  });
}

export function restorePlayer(players: Player[], id: string) {
  const me = players.find((player) => player.id === id);
  if (!me || isOnWall(me)) throw new Error("Dit briefje hangt al.");
  const bottom = Math.max(0, ...players.filter(isOnWall).map((player) => player.rank));
  return players.map((player) => (player.id === id ? { ...player, active: true, rank: bottom + 1 } : player));
}

export function sameOutcome(winnerScore: number, loserScore: number, nextWinnerScore: number, nextLoserScore: number) {
  const wasDraw = winnerScore === loserScore;
  const isDraw = nextWinnerScore === nextLoserScore;
  if (wasDraw || isDraw) return wasDraw && isDraw;
  return nextWinnerScore > nextLoserScore;
}

export function reviseMatch(
  players: Player[],
  match: { winnerId: string | null; loserId: string | null; swapped: boolean; stipAwarded: boolean },
  winnerScore: number,
  loserScore: number,
): SettleResult {
  const winner = players.find((player) => player.id === match.winnerId);
  const loser = players.find((player) => player.id === match.loserId);
  if (!winner || !loser) throw new Error("Een van de spelers is er niet meer.");
  let next = players.map((player) => ({ ...player }));
  if (match.stipAwarded) {
    next = next.map((player) =>
      player.id === winner.id ? { ...player, stippen: Math.max(0, player.stippen - 1) } : player,
    );
  }
  if (match.swapped && isOnWall(winner) && isOnWall(loser)) {
    const left = next.find((player) => player.id === winner.id);
    const right = next.find((player) => player.id === loser.id);
    if (left && right) {
      next = next.map((player) => {
        if (player.id === left.id) return { ...player, rank: right.rank };
        if (player.id === right.id) return { ...player, rank: left.rank };
        return player;
      });
    }
  }
  if (!isOnWall(winner) || !isOnWall(loser)) {
    const draw = winnerScore === loserScore;
    const winnerSide = !draw && winnerScore > loserScore;
    return {
      winnerId: winnerSide || draw ? winner.id : loser.id,
      loserId: winnerSide || draw ? loser.id : winner.id,
      winnerName: winnerSide || draw ? winner.name : loser.name,
      loserName: winnerSide || draw ? loser.name : winner.name,
      winnerScore: winnerSide || draw ? winnerScore : loserScore,
      loserScore: winnerSide || draw ? loserScore : winnerScore,
      winnerRankBefore: winner.rank,
      loserRankBefore: loser.rank,
      swapped: false,
      stipAwarded: false,
      draw,
      players: next,
    };
  }
  const settled = settleMatch(next.filter(isOnWall), winner.id, loser.id, winnerScore, loserScore, 99);
  return { ...settled, players: [...settled.players, ...next.filter((player) => !isOnWall(player))] };
}

export type GroupPlace = {
  id: string;
  name: string;
  score: number;
  rankBefore: number;
  rankAfter: number;
};

export type GroupResult = {
  players: Player[];
  places: GroupPlace[];
  swapped: boolean;
  stipAwarded: boolean;
  draw: boolean;
};

/** The players who played take each other's places. Higher score gets the better place. Cards between them stay. */
export function settleGroup(players: Player[], sides: { id: string; score: number }[]): GroupResult {
  if (sides.length < 2) throw new Error("Kies minstens twee spelers.");
  const seen = new Set<string>();
  const picked: { player: Player; score: number }[] = [];
  for (const side of sides) {
    if (!Number.isInteger(side.score) || side.score < 0 || side.score > 15) {
      throw new Error("De score ligt tussen 0 en 15.");
    }
    if (seen.has(side.id)) throw new Error("Een speler speelt maar één keer mee.");
    seen.add(side.id);
    const player = players.find((item) => item.id === side.id && isOnWall(item));
    if (!player) throw new Error("Speler niet gevonden.");
    picked.push({ player, score: side.score });
  }

  const slots = picked.map((item) => item.player.rank).sort((a, b) => a - b);
  const scored = [...picked].sort((a, b) => b.score - a.score || a.player.rank - b.player.rank);
  const draw = scored.every((item) => item.score === scored[0]?.score);
  const assignment = new Map<string, number>();
  scored.forEach((item, index) => {
    assignment.set(item.player.id, draw ? item.player.rank : slots[index]!);
  });

  const king = players.find((player) => isOnWall(player) && player.rank === 1);
  const kingScore = king ? scored.find((item) => item.player.id === king.id)?.score : undefined;
  const others = scored.filter((item) => item.player.id !== king?.id).map((item) => item.score);
  const stipAwarded = Boolean(
    king && kingScore != null && assignment.get(king.id) === 1 && others.length > 0 && kingScore > Math.max(...others),
  );

  const next = players.map((player) => {
    const rank = assignment.get(player.id);
    const stippen = stipAwarded && player.id === king?.id ? player.stippen + 1 : player.stippen;
    if (rank == null) return stippen === player.stippen ? player : { ...player, stippen };
    return { ...player, rank, stippen };
  });

  const places = scored.map((item) => ({
    id: item.player.id,
    name: item.player.name,
    score: item.score,
    rankBefore: item.player.rank,
    rankAfter: assignment.get(item.player.id) ?? item.player.rank,
  }));

  return {
    players: next,
    places,
    swapped: places.some((place) => place.rankBefore !== place.rankAfter),
    stipAwarded,
    draw,
  };
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
