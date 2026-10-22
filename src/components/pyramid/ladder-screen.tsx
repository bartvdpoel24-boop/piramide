import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, Copy, Crown, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import {
  challengeWhen,
  DAYS_LONG,
  DAYS_SHORT,
  fmtMin,
  fmtSlot,
  fmtWhen,
  matchSummary,
  TIME_OPTIONS,
  todayDayIndex,
} from "@/lib/pyramid/format";
import { canChallengeUp, legalDistance, normalizeSlots, overlapSlots, pyramidRows, settleMatch } from "@/lib/pyramid/rules";
import type { Challenge, Match, NoteColor, Player, Slot } from "@/lib/pyramid/types";
import { cn } from "@/lib/cn";
import { RackMark } from "./mark";
import { Shell } from "./shell";

type Tab = "uitdagingen" | "uitslagen" | "tijden" | "spelers";

type ResultDraft = {
  leftId: string;
  rightId: string;
  challengeId: string | null;
  lockPair: boolean;
};

export type LadderActions = {
  onChallenge: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
  }) => Promise<void>;
  onRespond: (id: string, action: "accept" | "decline" | "cancel") => Promise<void>;
  onResult: (input: {
    leftId: string;
    rightId: string;
    leftScore: number;
    rightScore: number;
    note: string;
    challengeId: string | null;
  }) => Promise<{ swapped: boolean; stipAwarded: boolean; draw: boolean; winnerName: string }>;
  onAvailability: (slots: Slot[]) => Promise<void>;
  onNudge?: (playerId: string, direction: -1 | 1) => Promise<void>;
  onRemove?: (playerId: string) => Promise<void>;
  onAdd?: (name: string) => Promise<void>;
  onRename?: (name: string) => Promise<void>;
  onPersona?: (playerId: string) => void;
  onReset?: () => void;
};

type Props = LadderActions & {
  mode: "demo" | "live";
  name: string;
  challengeRange: number;
  inviteCode?: string;
  amOwner: boolean;
  meId: string | null;
  players: Player[];
  challenges: Challenge[];
  matches: Match[];
};

const NOTE_BG: Record<NoteColor, string> = {
  ice: "var(--color-note-ice)",
  sky: "var(--color-note-sky)",
  butter: "var(--color-note-butter)",
  blush: "var(--color-note-blush)",
  coral: "var(--color-note-coral)",
  cream: "var(--color-note-cream)",
  lilac: "var(--color-note-lilac)",
  mint: "var(--color-note-mint)",
};

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Er ging iets mis. Probeer het nog eens.";
}

function resultToast(result: { swapped: boolean; stipAwarded: boolean; draw: boolean; winnerName: string }) {
  if (result.draw) return "Gelijkspel. De briefjes blijven hangen.";
  if (result.stipAwarded) return `${result.winnerName} houdt de troon. +1 stip.`;
  if (result.swapped) return `${result.winnerName} schuift omhoog. Briefjes gewisseld.`;
  return `${result.winnerName} wint. De piramide blijft staan.`;
}

export function LadderScreen(props: Props) {
  const { players, meId, challengeRange, challenges, matches } = props;
  const me = players.find((player) => player.id === meId) ?? null;
  const king = players.find((player) => player.rank === 1) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(me?.id ?? king?.id ?? null);
  const [tab, setTab] = useState<Tab>("uitdagingen");
  const [challengeFor, setChallengeFor] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState<ResultDraft | null>(null);
  const [onlyJoined, setOnlyJoined] = useState(false);
  const joined = useMemo(() => players.filter((player) => player.userId), [players]);
  const visible = onlyJoined ? joined : players;
  const rows = useMemo(() => pyramidRows(visible), [visible]);
  const selected = players.find((player) => player.id === selectedId) ?? null;
  const active = challenges.filter((item) => item.status === "open" || item.status === "accepted");
  const today = todayDayIndex();
  const freeToday = players.filter((player) => player.availability.some((slot) => slot.day === today));

  async function run(action: () => Promise<unknown> | unknown, success?: string) {
    try {
      await action();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  function openResult(leftId: string, rightId: string, challengeId: string | null, lockPair: boolean) {
    setResultDraft({ leftId, rightId, challengeId, lockPair });
  }

  return (
    <Shell place={props.mode === "demo" ? `Demo · ${props.name}` : props.name}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/" className="inline-flex items-center gap-2 text-ivory-dim">
            <RackMark className="h-7 w-8" />
            <span className="text-xs font-semibold tracking-widest uppercase">Piramide</span>
          </Link>
          <h1 className="font-display mt-1 truncate text-4xl italic">{props.name}</h1>
          <p className="text-sm text-ivory-dim">
            {props.mode === "demo"
              ? "Demo van de muur. Blijft op dit apparaat."
              : `Uitdagen tot ${challengeRange} plaatsen erboven.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {props.mode === "live" ? <UserButton /> : null}
          {props.inviteCode ? (
            <button
              type="button"
              className="btn btn-ghost h-9 min-h-0 px-3 text-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(props.inviteCode ?? "").then(
                  () => toast.success("Uitnodigingscode gekopieerd."),
                  () => toast(props.inviteCode ?? ""),
                );
              }}
            >
              <Copy className="size-4" />
              {props.inviteCode}
            </button>
          ) : null}
        </div>
      </header>

      {props.mode === "demo" && props.onPersona ? (
        <label className="panel mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-ivory-dim">Speel de demo als</span>
          <select
            className="field sm:max-w-xs"
            value={meId ?? ""}
            onChange={(event) => props.onPersona?.(event.target.value)}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.rank}. {player.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-brass uppercase">De troon</p>
          <p className="font-display text-2xl italic">
            {king ? king.name : "Nog leeg"}
            {king && king.stippen > 0 ? (
              <span className="ml-2 text-base text-brass not-italic">
                {king.stippen} stip{king.stippen === 1 ? "" : "pen"}
              </span>
            ) : null}
          </p>
        </div>
        <p className="max-w-sm text-sm text-ivory-dim">
          Daag maximaal {challengeRange} briefjes boven je uit. Win je, dan wissel je van plaats. Houdt de
          nummer 1 stand, dan een stip erbij.
        </p>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ivory-dim">
          {joined.length} van {players.length} aangemeld met de code. Dat blijft staan, ook als iemand nu niet
          ingelogd is.
        </p>
        <button
          type="button"
          aria-pressed={onlyJoined}
          className={cn("btn h-10 min-h-0 shrink-0 text-sm", onlyJoined ? "btn-brass" : "btn-ghost")}
          onClick={() => {
            const next = !onlyJoined;
            setOnlyJoined(next);
            if (next && selected && !selected.userId) {
              setSelectedId(joined[0]?.id ?? null);
            }
          }}
        >
          Alleen aangemeld
        </button>
      </div>

      <div className="mb-5 overflow-x-auto pb-2">
        <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3 px-2 py-2">
          {visible.length === 0 ? (
            <p className="panel px-4 py-6 text-sm text-ivory-dim">Nog niemand heeft de code gebruikt.</p>
          ) : null}
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-2">
              {row.map((player) => {
                const tilt = [-1.3, 1.1, -0.5, 1.4, -1, 0.7][(player.rank + rowIndex) % 6] ?? 0;
                const activeNote = player.id === selectedId;
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedId(player.id)}
                    aria-pressed={activeNote}
                    className={cn(
                      "note relative flex min-h-28 w-28 shrink-0 flex-col items-center justify-center px-2 py-2 text-center text-ink",
                      activeNote && "z-10 ring-2 ring-brass ring-offset-2 ring-offset-felt",
                    )}
                    style={{ background: NOTE_BG[player.note], transform: `rotate(${activeNote ? 0 : tilt}deg)` }}
                  >
                    <span className="text-xs tabular-nums opacity-70">#{player.rank}</span>
                    <span className="font-display line-clamp-3 text-base leading-tight italic">{player.name}</span>
                    {player.rank === 1 ? <Crown className="mt-1 size-4 text-brass-deep" /> : null}
                    {player.stippen > 0 ? (
                      <span className="mt-1 flex items-center gap-1" title={`${player.stippen} stippen`}>
                        {Array.from({ length: Math.min(player.stippen, 4) }, (_, index) => (
                          <span key={index} className="size-1.5 rounded-full bg-brass-deep" />
                        ))}
                        {player.stippen > 4 ? (
                          <span className="text-xs tabular-nums">{player.stippen}</span>
                        ) : null}
                      </span>
                    ) : null}
                    {player.userId ? (
                      <span className="mt-1 text-[10px] font-semibold tracking-wide text-brass-deep uppercase">
                        code
                      </span>
                    ) : null}
                    {player.id === meId ? (
                      <span className="mt-1 rounded-full bg-brass px-1.5 text-xs font-semibold tracking-wide text-ink uppercase">
                        Jij
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <PlayerPanel
          player={selected}
          me={me}
          range={challengeRange}
          amOwner={props.amOwner}
          players={players}
          onChallenge={() => setChallengeFor(selected.id)}
          onResult={(leftId, rightId, lockPair) => openResult(leftId, rightId, null, lockPair)}
          onNudge={
            props.onNudge
              ? (direction) => void run(() => props.onNudge?.(selected.id, direction))
              : undefined
          }
          onRemove={
            props.onRemove ? () => void run(() => props.onRemove?.(selected.id), "Briefje van de muur.") : undefined
          }
          onRename={
            props.onRename && me && selected.id === me.id
              ? (name) => void run(() => props.onRename?.(name), "Naam gewijzigd.")
              : undefined
          }
        />
      ) : (
        <p className="panel mb-4 p-4 text-sm text-ivory-dim">Tik een briefje om uit te dagen of een uitslag in te vullen.</p>
      )}

      {freeToday.length > 0 ? (
        <p className="mb-4 text-sm text-ivory-dim">
          Vandaag vrij: {freeToday.map((player) => player.name).join(", ")}
        </p>
      ) : null}

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(
          [
            ["uitdagingen", `Uitdagingen${active.length ? ` ${active.length}` : ""}`],
            ["uitslagen", "Uitslagen"],
            ["tijden", "Tijden"],
            ["spelers", "Spelers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("btn h-10 min-h-0 shrink-0 px-4 text-sm", tab === id ? "btn-brass" : "btn-ghost")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "uitdagingen" ? (
        <ChallengeList
          challenges={challenges}
          players={players}
          meId={meId}
          amOwner={props.amOwner}
          onRespond={(id, action) =>
            void run(
              () => props.onRespond(id, action),
              action === "accept" ? "Afgesproken." : action === "decline" ? "Afgewezen." : "Ingetrokken.",
            )
          }
          onResult={(challenge) => openResult(challenge.challengerId, challenge.defenderId, challenge.id, true)}
        />
      ) : null}

      {tab === "uitslagen" ? <MatchList matches={matches} /> : null}

      {tab === "tijden" ? (
        <TimesTab
          players={players}
          me={me}
          onSave={(slots) => void run(() => props.onAvailability(slots), "Tijden bewaard.")}
        />
      ) : null}

      {tab === "spelers" ? (
        <PlayersTab
          players={visible}
          onSelect={setSelectedId}
          amOwner={props.amOwner}
          onAdd={props.onAdd ? (name) => void run(() => props.onAdd?.(name), "Naam onderaan gezet.") : undefined}
          onReset={props.onReset ? () => void run(props.onReset!, "Demo teruggezet naar de muur.") : undefined}
          mode={props.mode}
        />
      ) : null}

      <ChallengeDialog
        defender={players.find((player) => player.id === challengeFor) ?? null}
        me={me}
        onClose={() => setChallengeFor(null)}
        onSubmit={(input) =>
          void run(async () => {
            await props.onChallenge(input);
            setChallengeFor(null);
            setTab("uitdagingen");
            toast.success("Uitdaging verstuurd.");
          })
        }
      />

      <ResultDialog
        draft={resultDraft}
        players={players}
        range={challengeRange}
        onClose={() => setResultDraft(null)}
        onChange={setResultDraft}
        onSubmit={(input) =>
          void run(async () => {
            const outcome = await props.onResult(input);
            setResultDraft(null);
            setTab("uitslagen");
            toast.success(resultToast(outcome));
          })
        }
      />
    </Shell>
  );
}

function RenameForm({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onRename(value);
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        Jouw naam
        <input
          className="field"
          value={value}
          maxLength={40}
          aria-label="Jouw naam"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-brass sm:self-end" disabled={value.trim() === name}>
        Bewaren
      </button>
    </form>
  );
}

function PlayerPanel({
  player,
  me,
  range,
  amOwner,
  players,
  onChallenge,
  onResult,
  onNudge,
  onRemove,
  onRename,
}: {
  player: Player;
  me: Player | null;
  range: number;
  amOwner: boolean;
  players: Player[];
  onChallenge: () => void;
  onResult: (leftId: string, rightId: string, lockPair: boolean) => void;
  onNudge?: (direction: -1 | 1) => void;
  onRemove?: () => void;
  onRename?: (name: string) => void;
}) {
  const upward = me ? canChallengeUp(me.rank, player.rank, range) : false;
  const betweenUs = me ? legalDistance(me.rank, player.rank, range) : false;
  const ownerOpponents = players.filter((other) => legalDistance(other.rank, player.rank, range));
  let hint = "Kies een actie, of tik een ander briefje.";
  if (me && player.id === me.id) hint = "Dit ben jij. Anderen kunnen jou uitdagen als ze dichtbij genoeg staan.";
  else if (upward) hint = `${player.name} staat ${me!.rank - player.rank} ${me!.rank - player.rank === 1 ? "plaats" : "plaatsen"} boven je.`;
  else if (me && player.rank < me.rank) hint = `${player.name} staat te ver boven je. Maximaal ${range} plaatsen.`;
  else if (me && player.rank > me.rank) hint = "Iemand onder je daagt zelf uit. Jij hoeft niet naar beneden.";

  return (
    <section className="panel mb-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-brass uppercase">Plek {player.rank}</p>
          <h2 className="font-display text-3xl italic">{player.name}</h2>
          <p className="text-sm text-ivory-dim">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {upward ? (
            <button type="button" className="btn btn-brass" onClick={onChallenge}>
              Uitdagen
            </button>
          ) : null}
          {me && betweenUs ? (
            <button type="button" className="btn btn-ivory" onClick={() => onResult(me.id, player.id, true)}>
              Uitslag
            </button>
          ) : null}
          {amOwner && ownerOpponents[0] && !(me && betweenUs) ? (
            <button
              type="button"
              className="btn btn-ivory"
              onClick={() => onResult(player.id, ownerOpponents[0]!.id, false)}
            >
              Uitslag invoeren
            </button>
          ) : null}
        </div>
      </div>
      {onRename ? <RenameForm key={player.name} name={player.name} onRename={onRename} /> : null}
      {player.availability.length > 0 ? (
        <p className="mt-3 text-sm text-ivory-dim">
          Vrij: {player.availability.map((slot) => fmtSlot(slot)).join(" · ")}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ivory-dim">Nog geen tijden doorgegeven.</p>
      )}
      {amOwner && onNudge ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={() => onNudge(-1)}>
            <ChevronUp className="size-4" /> Omhoog
          </button>
          <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={() => onNudge(1)}>
            <ChevronDown className="size-4" /> Omlaag
          </button>
          {onRemove ? (
            <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={onRemove}>
              <Trash2 className="size-4" /> Van de ladder
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChallengeList({
  challenges,
  players,
  meId,
  amOwner,
  onRespond,
  onResult,
}: {
  challenges: Challenge[];
  players: Player[];
  meId: string | null;
  amOwner: boolean;
  onRespond: (id: string, action: "accept" | "decline" | "cancel") => void;
  onResult: (challenge: Challenge) => void;
}) {
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "Onbekend";
  if (challenges.length === 0) {
    return (
      <p className="panel p-4 text-sm text-ivory-dim">
        Nog geen uitdagingen. Tik iemand boven je aan en daag diegene uit.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {challenges.map((challenge) => {
        const mine = challenge.challengerId === meId;
        const againstMe = challenge.defenderId === meId;
        const open = challenge.status === "open" || challenge.status === "accepted";
        return (
          <li key={challenge.id} className="panel p-4">
            <p className="font-display text-xl italic">
              {name(challenge.challengerId)} daagt {name(challenge.defenderId)} uit
            </p>
            <p className="text-sm text-ivory-dim">
              {challengeWhen(challenge)} · {labelStatus(challenge.status)}
              {challenge.message ? ` · ${challenge.message}` : ""}
            </p>
            {open ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {challenge.status === "open" && againstMe ? (
                  <>
                    <button type="button" className="btn btn-brass h-10 min-h-0 text-sm" onClick={() => onRespond(challenge.id, "accept")}>
                      Accepteren
                    </button>
                    <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={() => onRespond(challenge.id, "decline")}>
                      Afwijzen
                    </button>
                  </>
                ) : challenge.status === "open" ? (
                  <p className="basis-full text-sm text-ivory-dim">Alleen {name(challenge.defenderId)} kan accepteren.</p>
                ) : null}
                {(mine || amOwner) && (
                  <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={() => onRespond(challenge.id, "cancel")}>
                    Intrekken
                  </button>
                )}
                {(mine || againstMe || amOwner) && (
                  <button type="button" className="btn btn-ivory h-10 min-h-0 text-sm" onClick={() => onResult(challenge)}>
                    Uitslag
                  </button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function labelStatus(status: Challenge["status"]) {
  if (status === "open") return "open";
  if (status === "accepted") return "afgesproken";
  if (status === "declined") return "afgewezen";
  if (status === "played") return "gespeeld";
  return "ingetrokken";
}

function MatchList({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return <p className="panel p-4 text-sm text-ivory-dim">Nog geen partijen. De eerste uitslag komt hier te staan.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((match) => (
        <li key={match.id} className="panel p-4">
          <p className="font-display text-xl italic">{matchSummary(match)}</p>
          <p className="text-sm text-ivory-dim">
            {fmtWhen(match.playedAt)}
            {match.note ? ` · ${match.note}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TimesTab({
  players,
  me,
  onSave,
}: {
  players: Player[];
  me: Player | null;
  onSave: (slots: Slot[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {me ? <AvailabilityEditor player={me} onSave={onSave} /> : (
        <p className="panel p-4 text-sm text-ivory-dim">Koppel je naam om je tijden door te geven.</p>
      )}
      <div className="panel p-4">
        <h2 className="font-display mb-3 text-2xl italic">Wie kan wanneer</h2>
        <ul className="flex flex-col gap-3">
          {DAYS_LONG.map((day, index) => {
            const names = players.filter((player) => player.availability.some((slot) => slot.day === index));
            return (
              <li key={day} className="flex flex-col gap-1 border-b border-line pb-2 last:border-0 sm:flex-row sm:gap-4">
                <span className="w-28 shrink-0 text-sm tracking-wide text-brass uppercase">{day}</span>
                <span className="text-sm text-ivory-dim">
                  {names.length
                    ? names
                        .map((player) => {
                          const times = player.availability
                            .filter((item) => item.day === index)
                            .map((item) => `${fmtMin(item.startMin)}–${fmtMin(item.endMin)}`)
                            .join(", ");
                          return times ? `${player.name} ${times}` : player.name;
                        })
                        .join(" · ")
                    : "niemand doorgegeven"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function AvailabilityEditor({ player, onSave }: { player: Player; onSave: (slots: Slot[]) => void }) {
  const key = `${player.id}:${player.availability.map((slot) => `${slot.day}-${slot.startMin}-${slot.endMin}`).join("|")}`;
  return <AvailabilityForm key={key} player={player} onSave={onSave} />;
}

function AvailabilityForm({ player, onSave }: { player: Player; onSave: (slots: Slot[]) => void }) {
  const [slots, setSlots] = useState<Slot[]>(player.availability);

  function daySlots(day: number) {
    return slots
      .map((slot, index) => ({ slot, index }))
      .filter((item) => item.slot.day === day);
  }

  function toggle(day: number) {
    setSlots((current) =>
      current.some((slot) => slot.day === day)
        ? current.filter((slot) => slot.day !== day)
        : [...current, { day, startMin: 12 * 60, endMin: 13 * 60 }],
    );
  }

  function add(day: number) {
    setSlots((current) => {
      const mine = current.filter((slot) => slot.day === day).sort((a, b) => a.startMin - b.startMin);
      if (mine.length >= 4) return current;
      const last = mine[mine.length - 1];
      let startMin = last ? last.endMin : 12 * 60;
      let endMin = startMin + 60;
      if (endMin > 24 * 60) {
        startMin = 18 * 60;
        endMin = 19 * 60;
      }
      return [...current, { day, startMin, endMin }];
    });
  }

  function update(index: number, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function remove(index: number) {
    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  return (
    <form
      className="panel p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(normalizeSlots(slots));
      }}
    >
      <h2 className="font-display text-2xl italic">Jouw tijden</h2>
      <p className="mb-3 text-sm text-ivory-dim">Zet een dag aan. Je kunt meerdere tijden op dezelfde dag zetten.</p>
      <ul className="flex flex-col gap-3">
        {DAYS_SHORT.map((label, day) => {
          const mine = daySlots(day);
          return (
            <li key={label} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={mine.length > 0}
                  onClick={() => toggle(day)}
                  className={cn("btn h-10 min-h-0 w-14 px-0 text-sm uppercase", mine.length ? "btn-brass" : "btn-ghost")}
                >
                  {label}
                </button>
                {mine.length === 0 ? <span className="text-sm text-ivory-dim">niet vrij</span> : null}
              </div>
              {mine.map(({ slot, index }) => (
                <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2 pl-16">
                  <TimeSelect value={slot.startMin} onChange={(startMin) => update(index, { startMin })} />
                  <span className="text-ivory-dim">tot</span>
                  <TimeSelect value={slot.endMin} onChange={(endMin) => update(index, { endMin })} />
                  <button
                    type="button"
                    className="btn btn-quiet size-11 px-0"
                    aria-label={`${label} tijd weghalen`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {mine.length > 0 && mine.length < 4 ? (
                <button type="button" className="btn btn-ghost ml-16 self-start" onClick={() => add(day)}>
                  <Plus className="size-4" /> Nog een tijd
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="submit" className="btn btn-brass mt-4">
        Tijden bewaren
      </button>
    </form>
  );
}

function TimeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <select className="field w-auto" value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {TIME_OPTIONS.map((minutes) => (
        <option key={minutes} value={minutes}>
          {fmtMin(minutes)}
        </option>
      ))}
    </select>
  );
}

function PlayersTab({
  players,
  onSelect,
  amOwner,
  onAdd,
  onReset,
  mode,
}: {
  players: Player[];
  onSelect: (id: string) => void;
  amOwner: boolean;
  onAdd?: (name: string) => void;
  onReset?: () => void;
  mode: "demo" | "live";
}) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <ol className="panel divide-y divide-line">
        {players.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onSelect(player.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="w-8 tabular-nums text-brass">{player.rank}</span>
              <span className="font-display flex-1 text-lg italic">{player.name}</span>
              <span className="text-right text-sm text-ivory-dim">
                {player.userId ? "aangemeld" : ""}
                {player.userId && player.stippen > 0 ? " · " : ""}
                {player.stippen > 0 ? `${player.stippen} stip` : ""}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {amOwner && onAdd ? (
        <form
          className="panel flex flex-col gap-2 p-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd(name);
            setName("");
          }}
        >
          <input
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nieuwe naam onderaan"
            aria-label="Nieuwe naam"
          />
          <button type="submit" className="btn btn-brass">
            <Plus className="size-4" /> Inschrijven
          </button>
        </form>
      ) : null}
      {mode === "demo" && onReset ? (
        <button type="button" className="btn btn-ghost self-start" onClick={onReset}>
          Zet de muur terug
        </button>
      ) : null}
    </div>
  );
}

function ChallengeDialog({
  defender,
  me,
  onClose,
  onSubmit,
}: {
  defender: Player | null;
  me: Player | null;
  onClose: () => void;
  onSubmit: (input: { defenderId: string; day: number | null; startMin: number | null; message: string }) => void;
}) {
  const overlaps = me && defender ? overlapSlots(me.availability, defender.availability) : [];
  const [choice, setChoice] = useState("none");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setChoice(overlaps.length > 0 ? "0" : "none");
    setMessage("");
  }, [defender?.id, overlaps.length]);

  return (
    <Dialog.Root open={Boolean(defender)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
        <Dialog.Content className="sheet">
          <Dialog.Title className="font-display text-3xl italic">
            Daag {defender?.name} uit
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink/70">
            Spreek een moment af, of laat het open. Na de partij vul je de uitslag in.
          </Dialog.Description>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!defender) return;
              if (choice === "none") {
                onSubmit({ defenderId: defender.id, day: null, startMin: null, message });
                return;
              }
              const slot = overlaps[Number(choice)];
              if (!slot) return;
              onSubmit({ defenderId: defender.id, day: slot.day, startMin: slot.startMin, message });
            }}
          >
            {overlaps.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Jullie overlappen</legend>
                {overlaps.map((slot, index) => (
                  <label key={`${slot.day}-${slot.startMin}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="slot"
                      checked={choice === String(index)}
                      onChange={() => setChoice(String(index))}
                    />
                    {fmtSlot(slot)}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="slot" checked={choice === "none"} onChange={() => setChoice("none")} />
                  Tijd nog open
                </label>
              </fieldset>
            ) : (
              <p className="text-sm text-ink/70">Geen overlappende tijden. Daag toch uit en spreek het zelf af.</p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Bericht
              <input
                className="field-ink"
                value={message}
                maxLength={140}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Bijvoorbeeld: na de lunch, één partij"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-ink flex-1">
                Verstuur
              </button>
              <Dialog.Close type="button" className="btn btn-quiet">
                Terug
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultDialog({
  draft,
  players,
  range,
  onClose,
  onChange,
  onSubmit,
}: {
  draft: ResultDraft | null;
  players: Player[];
  range: number;
  onClose: () => void;
  onChange: (draft: ResultDraft) => void;
  onSubmit: (input: {
    leftId: string;
    rightId: string;
    leftScore: number;
    rightScore: number;
    note: string;
    challengeId: string | null;
  }) => void;
}) {
  const [leftScore, setLeftScore] = useState(1);
  const [rightScore, setRightScore] = useState(0);
  const [note, setNote] = useState("");
  const left = players.find((player) => player.id === draft?.leftId) ?? null;
  const right = players.find((player) => player.id === draft?.rightId) ?? null;
  const opponents =
    left && !draft?.lockPair
      ? players.filter((player) => legalDistance(player.rank, left.rank, range))
      : [];
  const preview = useMemo(() => {
    if (!left || !right) return null;
    try {
      return settleMatch(players, left.id, right.id, leftScore, rightScore, range);
    } catch {
      return null;
    }
  }, [left, right, leftScore, rightScore, players, range]);

  return (
    <Dialog.Root
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) onClose();
        setLeftScore(1);
        setRightScore(0);
        setNote("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
        <Dialog.Content className="sheet">
          <Dialog.Title className="font-display text-3xl italic">Uitslag</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink/70">
            Eén partij is vaak 1–0. Gelijke score is gelijkspel: de briefjes blijven hangen.
          </Dialog.Description>
          {left && draft && !draft.lockPair ? (
            <label className="mt-4 flex flex-col gap-1 text-sm">
              Tegenstander van {left.name}
              <select
                className="field-ink"
                value={draft.rightId}
                onChange={(event) => onChange({ ...draft, rightId: event.target.value })}
              >
                {opponents.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.rank}. {player.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-4 flex flex-col gap-3">
            <Stepper label={left?.name ?? "Links"} value={leftScore} onChange={setLeftScore} />
            <Stepper label={right?.name ?? "Rechts"} value={rightScore} onChange={setRightScore} />
          </div>
          <p className="mt-3 text-sm text-ink/80">
            {preview
              ? preview.draw
                ? "Gelijkspel. De briefjes blijven hangen."
                : preview.stipAwarded
                  ? `${preview.winnerName} verdedigt de troon. +1 stip.`
                  : preview.swapped
                    ? `${preview.winnerName} en ${preview.loserName} wisselen van plaats.`
                    : `${preview.winnerName} wint. De piramide blijft staan.`
              : "Deze twee staan te ver uit elkaar voor een geldige partij."}
          </p>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Notitie
            <input
              className="field-ink"
              value={note}
              maxLength={140}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optioneel"
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-ink flex-1"
              disabled={!preview || !draft}
              onClick={() =>
                draft &&
                onSubmit({
                  leftId: draft.leftId,
                  rightId: draft.rightId,
                  leftScore,
                  rightScore,
                  note,
                  challengeId: draft.challengeId,
                })
              }
            >
              Vastleggen
            </button>
            <Dialog.Close type="button" className="btn btn-quiet">
              Terug
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-display text-lg leading-tight italic">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-quiet size-11 px-0" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`${label} minder`}>
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center font-display text-3xl tabular-nums">{value}</span>
        <button type="button" className="btn btn-quiet size-11 px-0" onClick={() => onChange(Math.min(15, value + 1))} aria-label={`${label} meer`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
