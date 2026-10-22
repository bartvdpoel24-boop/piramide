import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { canChallengeUp, cleanName, normalizeSlots, settleMatch } from "./rules";
import { noteForIndex, WALL } from "./roster";
import {
  CHALLENGE_RANGE,
  NOTE_COLORS,
  type Challenge,
  type InvitePreview,
  type LadderSnapshot,
  type LadderSummary,
  type NoteColor,
  type Player,
  type Slot,
} from "./types";

type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function asNote(value: string): NoteColor {
  return NOTE_COLORS.includes(value as NoteColor) ? (value as NoteColor) : "cream";
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

type PlayerRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  rank: number;
  stippen: number;
  note_color: string;
};

async function loadPlayers(sql: Sql, ladderId: string): Promise<Player[]> {
  const rows = await sql<PlayerRow>`
    select id, user_id, display_name, rank, stippen, note_color
    from ladder_players
    where ladder_id = ${ladderId}
    order by rank
  `;
  const slots = await sql<{ player_id: string; day: number; start_min: number; end_min: number }>`
    select a.player_id, a.day, a.start_min, a.end_min
    from ladder_availability a
    join ladder_players p on p.id = a.player_id
    where p.ladder_id = ${ladderId}
    order by a.day, a.start_min
  `;
  const byPlayer = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = byPlayer.get(slot.player_id) ?? [];
    list.push({ day: Number(slot.day), startMin: Number(slot.start_min), endMin: Number(slot.end_min) });
    byPlayer.set(slot.player_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    rank: Number(row.rank),
    stippen: Number(row.stippen),
    note: asNote(row.note_color),
    userId: row.user_id,
    availability: byPlayer.get(row.id) ?? [],
  }));
}

async function requireLadder(sql: Sql, userId: string, ladderId: string) {
  const ladders = await sql<{
    id: string;
    name: string;
    invite_code: string;
    challenge_range: number;
    owner_id: string;
  }>`select id, name, invite_code, challenge_range, owner_id from ladders where id = ${ladderId}`;
  const ladder = ladders[0];
  if (!ladder) throw new Error("Ladder niet gevonden.");
  const mine = await sql<{ id: string }>`
    select id from ladder_players where ladder_id = ${ladderId} and user_id = ${userId}
  `;
  const amOwner = ladder.owner_id === userId;
  if (!mine[0] && !amOwner) throw new Error("Je zit niet op deze ladder.");
  return {
    ladder,
    meId: mine[0]?.id ?? null,
    amOwner,
    range: Number(ladder.challenge_range) || CHALLENGE_RANGE,
  };
}

async function snapshot(sql: Sql, userId: string, ladderId: string): Promise<LadderSnapshot> {
  const access = await requireLadder(sql, userId, ladderId);
  const players = await loadPlayers(sql, ladderId);
  const challenges = await sql<{
    id: string;
    challenger_id: string;
    defender_id: string;
    status: Challenge["status"];
    proposed_day: number | null;
    proposed_start_min: number | null;
    message: string;
    created_at: unknown;
  }>`
    select id, challenger_id, defender_id, status, proposed_day, proposed_start_min, message, created_at
    from ladder_challenges
    where ladder_id = ${ladderId}
    order by created_at desc
    limit 80
  `;
  const matches = await sql<{
    id: string;
    winner_id: string | null;
    loser_id: string | null;
    winner_name: string;
    loser_name: string;
    winner_score: number;
    loser_score: number;
    winner_rank_before: number;
    loser_rank_before: number;
    swapped: boolean;
    stip_awarded: boolean;
    played_at: unknown;
    note: string;
    challenge_id: string | null;
  }>`
    select id, winner_id, loser_id, winner_name, loser_name, winner_score, loser_score,
           winner_rank_before, loser_rank_before, swapped, stip_awarded, played_at, note, challenge_id
    from ladder_matches
    where ladder_id = ${ladderId}
    order by played_at desc
    limit 80
  `;
  return {
    id: access.ladder.id,
    name: access.ladder.name,
    inviteCode: access.ladder.invite_code,
    challengeRange: access.range,
    amOwner: access.amOwner,
    meId: access.meId,
    players,
    challenges: challenges.map((row) => ({
      id: row.id,
      challengerId: row.challenger_id,
      defenderId: row.defender_id,
      status: row.status,
      proposedDay: row.proposed_day == null ? null : Number(row.proposed_day),
      proposedStartMin: row.proposed_start_min == null ? null : Number(row.proposed_start_min),
      message: row.message,
      createdAt: iso(row.created_at),
    })),
    matches: matches.map((row) => ({
      id: row.id,
      winnerId: row.winner_id,
      loserId: row.loser_id,
      winnerName: row.winner_name,
      loserName: row.loser_name,
      winnerScore: Number(row.winner_score),
      loserScore: Number(row.loser_score),
      winnerRankBefore: Number(row.winner_rank_before),
      loserRankBefore: Number(row.loser_rank_before),
      swapped: Boolean(row.swapped),
      stipAwarded: Boolean(row.stip_awarded),
      playedAt: iso(row.played_at),
      note: row.note,
      challengeId: row.challenge_id,
    })),
  };
}

async function swapRanks(sql: Sql, ladderId: string, aId: string, aRank: number, bId: string, bRank: number) {
  await sql`
    update ladder_players set rank = -rank
    where ladder_id = ${ladderId} and id in (${aId}, ${bId})
  `;
  await sql`update ladder_players set rank = ${bRank} where id = ${aId} and ladder_id = ${ladderId}`;
  await sql`update ladder_players set rank = ${aRank} where id = ${bId} and ladder_id = ${ladderId}`;
}

export const listMyLadders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LadderSummary[]> => {
    const sql = await db();
    const rows = await sql<{
      id: string;
      name: string;
      invite_code: string;
      my_rank: number | null;
      my_name: string | null;
      king_name: string | null;
      player_count: number;
      open_challenges: number;
    }>`
      select l.id, l.name, l.invite_code,
        me.rank as my_rank,
        me.display_name as my_name,
        king.display_name as king_name,
        (select count(*) from ladder_players p where p.ladder_id = l.id) as player_count,
        (select count(*) from ladder_challenges c
          where c.ladder_id = l.id and c.status in ('open', 'accepted')) as open_challenges
      from ladders l
      left join ladder_players me on me.ladder_id = l.id and me.user_id = ${context.userId}
      left join ladder_players king on king.ladder_id = l.id and king.rank = 1
      where l.owner_id = ${context.userId} or me.id is not null
      order by l.created_at desc
    `;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      myRank: row.my_rank == null ? null : Number(row.my_rank),
      myName: row.my_name,
      kingName: row.king_name,
      playerCount: Number(row.player_count),
      openChallenges: Number(row.open_challenges),
    }));
  });

const createInput = (input: {
  name: string;
  importWall: boolean;
  claimName: string;
}) => {
  const name = cleanName(input?.name ?? "");
  if (name.length > 40) throw new Error("Kies een kortere naam voor de piramide.");
  const claimName = cleanName(input?.claimName ?? "");
  return { name, importWall: Boolean(input?.importWall), claimName };
};

export const createLadder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createInput)
  .handler(async ({ context, data }) => {
    const sql = await db();
    const ladderId = crypto.randomUUID();
    let code = inviteCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await sql<{ id: string }>`select id from ladders where invite_code = ${code}`;
      if (!existing[0]) break;
      code = inviteCode();
    }
    await sql`
      insert into ladders (id, name, invite_code, challenge_range, owner_id)
      values (${ladderId}, ${data.name}, ${code}, ${CHALLENGE_RANGE}, ${context.userId})
    `;
    if (data.importWall) {
      const claim = WALL.find((person) => person.name.toLowerCase() === data.claimName.toLowerCase());
      for (const [index, person] of WALL.entries()) {
        const id = crypto.randomUUID();
        const linked = claim?.id === person.id;
        await sql`
          insert into ladder_players (id, ladder_id, user_id, display_name, rank, stippen, note_color)
          values (
            ${id}, ${ladderId}, ${linked ? context.userId : null}, ${person.name},
            ${index + 1}, 0, ${person.note}
          )
        `;
      }
      if (!claim) {
        await sql`
          insert into ladder_players (id, ladder_id, user_id, display_name, rank, stippen, note_color)
          values (
            ${crypto.randomUUID()}, ${ladderId}, ${context.userId}, ${data.claimName},
            ${WALL.length + 1}, 0, ${noteForIndex(WALL.length)}
          )
        `;
      }
    } else {
      await sql`
        insert into ladder_players (id, ladder_id, user_id, display_name, rank, stippen, note_color)
        values (
          ${crypto.randomUUID()}, ${ladderId}, ${context.userId}, ${data.claimName},
          1, 0, 'sky'
        )
      `;
    }
    return { id: ladderId };
  });

export const previewInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => {
    const clean = String(code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(clean)) throw new Error("Die code klopt niet.");
    return clean;
  })
  .handler(async ({ context, data: code }): Promise<InvitePreview> => {
    const sql = await db();
    const ladders = await sql<{ id: string; name: string }>`
      select id, name from ladders where invite_code = ${code}
    `;
    const ladder = ladders[0];
    if (!ladder) throw new Error("Geen piramide met die code.");
    const players = await sql<{ id: string; display_name: string; rank: number; user_id: string | null }>`
      select id, display_name, rank, user_id from ladder_players where ladder_id = ${ladder.id} order by rank
    `;
    return {
      id: ladder.id,
      name: ladder.name,
      playerCount: players.length,
      alreadyIn: players.some((player) => player.user_id === context.userId),
      players: players.map((player) => ({
        id: player.id,
        name: player.display_name,
        rank: Number(player.rank),
        claimed: Boolean(player.user_id),
      })),
    };
  });

export const joinLadder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code: string; playerId: string | null; name: string }) => {
    const code = String(input?.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error("Die code klopt niet.");
    const playerId = input?.playerId ? String(input.playerId) : null;
    const name = playerId ? "" : cleanName(input?.name ?? "");
    return { code, playerId, name };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const ladders = await sql<{ id: string }>`select id from ladders where invite_code = ${data.code}`;
    const ladder = ladders[0];
    if (!ladder) throw new Error("Geen piramide met die code.");
    const existing = await sql<{ id: string }>`
      select id from ladder_players where ladder_id = ${ladder.id} and user_id = ${context.userId}
    `;
    if (existing[0]) return { id: ladder.id };
    if (data.playerId) {
      const updated = await sql<{ id: string }>`
        update ladder_players set user_id = ${context.userId}
        where id = ${data.playerId} and ladder_id = ${ladder.id} and user_id is null
        returning id
      `;
      if (!updated[0]) throw new Error("Die naam is al gekoppeld. Kies een andere.");
      return { id: ladder.id };
    }
    const counts = await sql<{ max_rank: number | null }>`
      select max(rank) as max_rank from ladder_players where ladder_id = ${ladder.id}
    `;
    const rank = Number(counts[0]?.max_rank ?? 0) + 1;
    await sql`
      insert into ladder_players (id, ladder_id, user_id, display_name, rank, stippen, note_color)
      values (
        ${crypto.randomUUID()}, ${ladder.id}, ${context.userId}, ${data.name},
        ${rank}, 0, ${noteForIndex(rank)}
      )
    `;
    return { id: ladder.id };
  });

export const getLadder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (typeof id !== "string" || id.length < 8) throw new Error("Ladder niet gevonden.");
    return id;
  })
  .handler(async ({ context, data: id }) => {
    const sql = await db();
    return snapshot(sql, context.userId, id);
  });

export const setAvailability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; slots: Slot[] }) => {
    if (!input?.ladderId) throw new Error("Ladder ontbreekt.");
    const slots = Array.isArray(input.slots) ? input.slots : [];
    return { ladderId: String(input.ladderId), slots: normalizeSlots(slots) };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    if (!access.meId) throw new Error("Koppel eerst je naam aan de ladder.");
    await sql`delete from ladder_availability where player_id = ${access.meId}`;
    for (const slot of data.slots) {
      await sql`
        insert into ladder_availability (id, player_id, day, start_min, end_min)
        values (${crypto.randomUUID()}, ${access.meId}, ${slot.day}, ${slot.startMin}, ${slot.endMin})
      `;
    }
    return { ok: true };
  });

export const createChallenge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      ladderId: string;
      defenderId: string;
      day: number | null;
      startMin: number | null;
      message: string;
    }) => {
      if (!input?.ladderId || !input.defenderId) throw new Error("Kies wie je uitdaagt.");
      const day = input.day == null ? null : Number(input.day);
      const startMin = input.startMin == null ? null : Number(input.startMin);
      if ((day == null) !== (startMin == null)) throw new Error("Dag en tijd horen bij elkaar.");
      return {
        ladderId: String(input.ladderId),
        defenderId: String(input.defenderId),
        day,
        startMin,
        message: String(input.message ?? "").slice(0, 140),
      };
    },
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    if (!access.meId) throw new Error("Koppel eerst je naam aan de ladder.");
    const players = await loadPlayers(sql, data.ladderId);
    const me = players.find((player) => player.id === access.meId);
    const defender = players.find((player) => player.id === data.defenderId);
    if (!me || !defender) throw new Error("Speler niet gevonden.");
    if (!canChallengeUp(me.rank, defender.rank, access.range)) {
      throw new Error(`Je kunt alleen iemand tot ${access.range} plaatsen boven je uitdagen.`);
    }
    const pending = await sql<{ id: string }>`
      select id from ladder_challenges
      where ladder_id = ${data.ladderId}
        and status in ('open', 'accepted')
        and (
          (challenger_id = ${me.id} and defender_id = ${defender.id})
          or (challenger_id = ${defender.id} and defender_id = ${me.id})
        )
    `;
    if (pending[0]) throw new Error("Er staat al een open uitdaging tussen jullie.");
    await sql`
      insert into ladder_challenges (
        id, ladder_id, challenger_id, defender_id, status, proposed_day, proposed_start_min, message, created_by
      ) values (
        ${crypto.randomUUID()}, ${data.ladderId}, ${me.id}, ${defender.id}, 'open',
        ${data.day}, ${data.startMin}, ${data.message}, ${context.userId}
      )
    `;
    return { ok: true };
  });

export const respondChallenge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; challengeId: string; action: "accept" | "decline" | "cancel" }) => {
    if (!input?.ladderId || !input.challengeId) throw new Error("Uitdaging ontbreekt.");
    if (input.action !== "accept" && input.action !== "decline" && input.action !== "cancel") {
      throw new Error("Onbekende actie.");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    const rows = await sql<{
      id: string;
      challenger_id: string;
      defender_id: string;
      status: string;
    }>`
      select id, challenger_id, defender_id, status
      from ladder_challenges
      where id = ${data.challengeId} and ladder_id = ${data.ladderId}
    `;
    const challenge = rows[0];
    if (!challenge) throw new Error("Uitdaging niet gevonden.");
    const players = await loadPlayers(sql, data.ladderId);
    const challenger = players.find((player) => player.id === challenge.challenger_id);
    const defender = players.find((player) => player.id === challenge.defender_id);
    const isChallenger = challenger?.userId === context.userId;
    const isDefender = defender?.userId === context.userId;
    if (data.action === "cancel") {
      if (!isChallenger && !access.amOwner) throw new Error("Alleen de uitdager kan intrekken.");
      if (challenge.status !== "open" && challenge.status !== "accepted") {
        throw new Error("Deze uitdaging is al afgerond.");
      }
    } else {
      if (!isDefender) throw new Error("Je kunt alleen een uitdaging accepteren of afwijzen die voor jou is.");
      if (challenge.status !== "open") throw new Error("Deze uitdaging is al beantwoord.");
    }
    const status = data.action === "accept" ? "accepted" : data.action === "decline" ? "declined" : "cancelled";
    await sql`update ladder_challenges set status = ${status} where id = ${challenge.id}`;
    return { ok: true };
  });

export const recordResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      ladderId: string;
      leftId: string;
      rightId: string;
      leftScore: number;
      rightScore: number;
      note: string;
      challengeId?: string | null;
    }) => {
      if (!input?.ladderId || !input.leftId || !input.rightId) throw new Error("Kies beide spelers.");
      return {
        ladderId: String(input.ladderId),
        leftId: String(input.leftId),
        rightId: String(input.rightId),
        leftScore: Number(input.leftScore),
        rightScore: Number(input.rightScore),
        note: String(input.note ?? "").slice(0, 140),
        challengeId: input.challengeId ? String(input.challengeId) : null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    const players = await loadPlayers(sql, data.ladderId);
    const left = players.find((player) => player.id === data.leftId);
    const right = players.find((player) => player.id === data.rightId);
    if (!left || !right) throw new Error("Speler niet gevonden.");
    const involved = left.userId === context.userId || right.userId === context.userId;
    if (!involved && !access.amOwner) throw new Error("Alleen de spelers of de beheerder vullen de uitslag in.");
    if (data.challengeId) {
      const rows = await sql<{ challenger_id: string; defender_id: string; status: string }>`
        select challenger_id, defender_id, status from ladder_challenges
        where id = ${data.challengeId} and ladder_id = ${data.ladderId}
      `;
      const challenge = rows[0];
      if (!challenge) throw new Error("Uitdaging niet gevonden.");
      if (challenge.status !== "open" && challenge.status !== "accepted") {
        throw new Error("Deze uitdaging is al gespeeld.");
      }
      const ids = new Set([challenge.challenger_id, challenge.defender_id]);
      if (!ids.has(left.id) || !ids.has(right.id)) throw new Error("De uitslag hoort niet bij deze uitdaging.");
    }
    const settled = settleMatch(players, left.id, right.id, data.leftScore, data.rightScore, access.range);
    if (settled.swapped) {
      await swapRanks(
        sql,
        data.ladderId,
        settled.winnerId,
        settled.winnerRankBefore,
        settled.loserId,
        settled.loserRankBefore,
      );
    }
    if (settled.stipAwarded) {
      await sql`update ladder_players set stippen = stippen + 1 where id = ${settled.winnerId}`;
    }
    await sql`
      insert into ladder_matches (
        id, ladder_id, challenge_id, winner_id, loser_id, winner_name, loser_name,
        winner_score, loser_score, winner_rank_before, loser_rank_before,
        swapped, stip_awarded, played_at, note, recorded_by
      ) values (
        ${crypto.randomUUID()}, ${data.ladderId}, ${data.challengeId},
        ${settled.winnerId}, ${settled.loserId}, ${settled.winnerName}, ${settled.loserName},
        ${settled.winnerScore}, ${settled.loserScore}, ${settled.winnerRankBefore}, ${settled.loserRankBefore},
        ${settled.swapped}, ${settled.stipAwarded}, now(), ${data.note}, ${context.userId}
      )
    `;
    if (data.challengeId) {
      await sql`update ladder_challenges set status = 'played' where id = ${data.challengeId}`;
    }
    return {
      swapped: settled.swapped,
      stipAwarded: settled.stipAwarded,
      draw: settled.draw,
      winnerName: settled.winnerName,
    };
  });

export const nudgeLadderPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; playerId: string; direction: -1 | 1 }) => {
    if (!input?.ladderId || !input.playerId) throw new Error("Speler ontbreekt.");
    if (input.direction !== -1 && input.direction !== 1) throw new Error("Ongeldige richting.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    if (!access.amOwner) throw new Error("Alleen de beheerder verschuift briefjes.");
    const players = await loadPlayers(sql, data.ladderId);
    const me = players.find((player) => player.id === data.playerId);
    const other = players.find((player) => player.rank === (me?.rank ?? 0) + data.direction);
    if (!me || !other) throw new Error(data.direction < 0 ? "Staat al bovenaan." : "Staat al onderaan.");
    await swapRanks(sql, data.ladderId, me.id, me.rank, other.id, other.rank);
    return { ok: true };
  });

export const removeLadderPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; playerId: string }) => {
    if (!input?.ladderId || !input.playerId) throw new Error("Speler ontbreekt.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    if (!access.amOwner) throw new Error("Alleen de beheerder haalt iemand van de ladder.");
    const players = await loadPlayers(sql, data.ladderId);
    if (players.length <= 1) throw new Error("De laatste speler blijft op de ladder.");
    const me = players.find((player) => player.id === data.playerId);
    if (!me) throw new Error("Speler niet gevonden.");
    await sql`delete from ladder_players where id = ${me.id} and ladder_id = ${data.ladderId}`;
    await sql`
      update ladder_players set rank = rank + 1000
      where ladder_id = ${data.ladderId} and rank > ${me.rank}
    `;
    await sql`
      update ladder_players set rank = rank - 1001
      where ladder_id = ${data.ladderId} and rank > 1000
    `;
    return { ok: true };
  });

export const renameMe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; name: string }) => ({
    ladderId: String(input?.ladderId ?? ""),
    name: cleanName(input?.name ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireLadder(sql, context.userId, data.ladderId);
    const mine = await sql<{ id: string }>`
      select id from ladder_players
      where ladder_id = ${data.ladderId} and user_id = ${context.userId}
    `;
    const me = mine[0];
    if (!me) throw new Error("Koppel eerst je naam aan de ladder.");
    const dupes = await sql<{ id: string }>`
      select id from ladder_players
      where ladder_id = ${data.ladderId}
        and id <> ${me.id}
        and lower(display_name) = lower(${data.name})
    `;
    if (dupes[0]) throw new Error("Die naam staat al op de ladder.");
    await sql`
      update ladder_players set display_name = ${data.name}
      where id = ${me.id} and ladder_id = ${data.ladderId}
    `;
    return { ok: true };
  });

export const addLadderPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ladderId: string; name: string }) => ({
    ladderId: String(input?.ladderId ?? ""),
    name: cleanName(input?.name ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const access = await requireLadder(sql, context.userId, data.ladderId);
    if (!access.amOwner) throw new Error("Alleen de beheerder schrijft nieuwe namen bij.");
    const dupes = await sql<{ id: string }>`
      select id from ladder_players
      where ladder_id = ${data.ladderId} and lower(display_name) = lower(${data.name})
    `;
    if (dupes[0]) throw new Error("Die naam staat al op de ladder.");
    const counts = await sql<{ max_rank: number | null }>`
      select max(rank) as max_rank from ladder_players where ladder_id = ${data.ladderId}
    `;
    const rank = Number(counts[0]?.max_rank ?? 0) + 1;
    await sql`
      insert into ladder_players (id, ladder_id, user_id, display_name, rank, stippen, note_color)
      values (
        ${crypto.randomUUID()}, ${data.ladderId}, null, ${data.name}, ${rank}, 0, ${noteForIndex(rank)}
      )
    `;
    return { ok: true };
  });

