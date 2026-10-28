import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, Copy, Crown, Minus, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  challengeWhen,
  DAYS_LONG,
  fmtMin,
  fmtSlot,
  fmtWhen,
  matchSummary,
  todayDayIndex,
} from "@/lib/pyramid/format";
import { canChallengeUp, canInviteDown, isOnWall, isPyramidAdmin, legalDistance, overlapSlots, pyramidRows, reviseMatch, sameOutcome, settleMatch } from "@/lib/pyramid/rules";
import { NOTE_BG } from "@/lib/pyramid/notes";
import { lastResults, type LastResult } from "@/lib/pyramid/stats";
import { joinMessage, joinUrl, seatMessage, whatsAppHref } from "@/lib/pyramid/share";
import type { Challenge, Match, Player, Slot } from "@/lib/pyramid/types";
import { cn } from "@/lib/cn";
import { RackMark } from "./mark";
import { Shell } from "./shell";

type Tab = "piramide" | "uitslagen" | "uitdagingen" | "tijden" | "deelnemers";

type ResultDraft = {
  leftId: string;
  rightId: string;
  challengeId: string | null;
  lockPair: boolean;
  matchId?: string;
  leftScore?: number;
  rightScore?: number;
  note?: string;
  swapped?: boolean;
  stipAwarded?: boolean;
};

export type LadderActions = {
  onChallenge: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
    kind: "challenge" | "invite";
  }) => Promise<{ mailed?: boolean; notify?: boolean } | void>;
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
  onRestore?: (playerId: string) => Promise<void>;
  onEditResult?: (input: {
    matchId: string;
    winnerScore: number;
    loserScore: number;
    note: string;
  }) => Promise<{ swapped: boolean; stipAwarded: boolean; draw: boolean; winnerName: string }>;
  onAdd?: (name: string) => Promise<void>;
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
  const wall = useMemo(() => players.filter((player) => isOnWall(player)), [players]);
  const bench = useMemo(() => players.filter((player) => !isOnWall(player)), [players]);
  const me = players.find((player) => player.id === meId) ?? null;
  const king = wall.find((player) => player.rank === 1) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(isOnWall(me ?? { active: false }) ? me?.id ?? king?.id ?? null : king?.id ?? null);
  const [tab, setTab] = useState<Tab>("piramide");
  const [approach, setApproach] = useState<{ id: string; kind: "challenge" | "invite" } | null>(null);
  const [resultDraft, setResultDraft] = useState<ResultDraft | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Player | null>(null);
  const [onlyJoined, setOnlyJoined] = useState(false);
  const joined = useMemo(() => wall.filter((player) => player.userId), [wall]);
  const visible = onlyJoined ? joined : wall;
  const rows = useMemo(() => pyramidRows(visible), [visible]);
  const latest = useMemo(() => lastResults(matches), [matches]);
  const selected = wall.find((player) => player.id === selectedId) ?? null;
  const active = challenges.filter((item) => item.status === "open" || item.status === "accepted");
  const today = todayDayIndex();
  const freeToday = wall.filter((player) => player.availability.some((slot) => slot.day === today));

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
          {props.mode === "demo" ? (
            <p className="text-sm text-ivory-dim">Demo van de muur. Blijft op dit apparaat.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {props.inviteCode ? (
            <>
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
              <ShareLadder name={props.name} code={props.inviteCode} />
            </>
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

      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-felt px-2 py-2">
        <div className="grid grid-cols-5 items-start gap-1" role="tablist" aria-label="Onderdelen">
          {(
            [
              ["piramide", "Piramide"],
              ["uitslagen", "Uitslagen"],
              ["uitdagingen", "Uitdagingen"],
              ["tijden", "Tijden"],
              ["deelnemers", "Deelnemers"],
            ] as const
          ).map(([id, label]) => (
            <div key={id} className="flex flex-col items-center gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn("btn tab-tile", tab === id ? "btn-brass" : "btn-ghost")}
              >
                {label}
              </button>
              {id === "uitdagingen" && active.length > 0 ? (
                <button
                  type="button"
                  className="text-xs text-ivory underline decoration-brass underline-offset-2"
                  onClick={() => setTab("uitdagingen")}
                >
                  {active.length} open
                </button>
              ) : (
                <span className="h-4" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>

      {tab === "piramide" ? (
        <>
          <div className="mb-4 flex justify-end">
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

          <PyramidBoard
            rows={rows}
            empty={visible.length === 0}
            selectedId={selectedId}
            meId={meId}
            latest={latest}
            onSelect={setSelectedId}
          />

          {selected ? (
            <PlayerPanel
              player={selected}
              me={me}
              range={challengeRange}
              amOwner={props.amOwner}
              players={wall}
              onChallenge={() => setApproach({ id: selected.id, kind: "challenge" })}
              onInvite={() => setApproach({ id: selected.id, kind: "invite" })}
              onResult={(leftId, rightId, lockPair) => openResult(leftId, rightId, null, lockPair)}
              onNudge={
                props.onNudge
                  ? (direction) => void run(() => props.onNudge?.(selected.id, direction))
                  : undefined
              }
              onRemove={props.onRemove && isPyramidAdmin(me) ? () => setPendingRemove(selected) : undefined}
            />
          ) : (
            <p className="panel mb-4 p-4 text-sm text-ivory-dim">Tik een briefje om uit te dagen of een uitslag in te vullen.</p>
          )}
        </>
      ) : null}

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

      {tab === "uitslagen" ? (
        <MatchList
          matches={matches}
          onEdit={
            props.onEditResult
              ? (match) => {
                  if (!match.winnerId || !match.loserId) return;
                  setResultDraft({
                    leftId: match.winnerId,
                    rightId: match.loserId,
                    challengeId: null,
                    lockPair: true,
                    matchId: match.id,
                    leftScore: match.winnerScore,
                    rightScore: match.loserScore,
                    note: match.note,
                    swapped: match.swapped,
                    stipAwarded: match.stipAwarded,
                  });
                }
              : undefined
          }
          canEdit={(match) => match.winnerId === meId || match.loserId === meId || isPyramidAdmin(me)}
        />
      ) : null}

      {tab === "tijden" ? (
        <>
          {freeToday.length > 0 ? (
            <p className="mb-4 text-sm text-ivory-dim">
              Vandaag vrij: {freeToday.map((player) => player.name).join(", ")}
            </p>
          ) : null}
          <TimesTab players={wall} />
        </>
      ) : null}

      {tab === "deelnemers" ? (
        <PlayersTab
          players={wall}
          bench={bench}
          inviteCode={props.inviteCode}
          ladderName={props.name}
          onSelect={(id) => {
            setSelectedId(id);
            setTab("piramide");
          }}
          amOwner={props.amOwner}
          onRestore={
            props.onRestore && isPyramidAdmin(me)
              ? (id) => void run(() => props.onRestore?.(id), "Briefje hangt weer onderaan.")
              : undefined
          }
          onAdd={props.onAdd ? (name) => void run(() => props.onAdd?.(name), "Naam onderaan gezet.") : undefined}
          onReset={props.onReset ? () => void run(props.onReset!, "Demo teruggezet naar de muur.") : undefined}
          mode={props.mode}
        />
      ) : null}

      <ChallengeDialog
        defender={players.find((player) => player.id === approach?.id) ?? null}
        me={me}
        kind={approach?.kind ?? "challenge"}
        onClose={() => setApproach(null)}
        onSubmit={(input) =>
          void run(async () => {
            const result = await props.onChallenge(input);
            setApproach(null);
            setTab("uitdagingen");
            const mailed = Boolean(result && result.mailed);
            const notify = Boolean(result && result.notify);
            toast.success(
              input.kind === "invite"
                ? "Uitnodiging verstuurd."
                : mailed
                  ? "Uitdaging verstuurd. De mail is onderweg."
                  : notify
                    ? "Uitdaging verstuurd. De mail kon niet worden bezorgd."
                    : "Uitdaging verstuurd.",
            );
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
            const outcome =
              input.matchId && props.onEditResult
                ? await props.onEditResult({
                    matchId: input.matchId,
                    winnerScore: input.leftScore,
                    loserScore: input.rightScore,
                    note: input.note,
                  })
                : await props.onResult(input);
            setResultDraft(null);
            setTab("uitslagen");
            toast.success(input.matchId ? "Score bijgewerkt." : resultToast(outcome));
          })
        }
      />

      <Dialog.Root open={Boolean(pendingRemove)} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
          <Dialog.Content className="sheet">
            <Dialog.Title className="font-display text-3xl italic">Briefje weghalen</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink/70">
              {pendingRemove?.name} gaat van de piramide. Het account en de naam blijven bewaard, zodat je het briefje
              later terug kunt zetten.
            </Dialog.Description>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn btn-ink flex-1"
                onClick={() => {
                  const player = pendingRemove;
                  setPendingRemove(null);
                  if (!player) return;
                  void run(() => props.onRemove?.(player.id), "Briefje staat naast de piramide.");
                }}
              >
                Weghalen
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setPendingRemove(null)}>
                Annuleren
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Shell>
  );
}

function clampScale(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function PyramidBoard({
  rows,
  empty,
  selectedId,
  meId,
  latest,
  onSelect,
}: {
  rows: Player[][];
  empty: boolean;
  selectedId: string | null;
  meId: string | null;
  latest: Map<string, LastResult>;
  onSelect: (id: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const fitRef = useRef(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const fit =
    natural.w > 0 && frame.w > 0 ? Math.min(1, frame.w / natural.w, frame.h > 0 ? frame.h / natural.h : 1) : 1;
  const zoomed = fit < 0.98;

  useLayoutEffect(() => {
    const board = boardRef.current;
    const frameEl = frameRef.current;
    if (!board || !frameEl) return;
    const measure = () => {
      setNatural({ w: Math.max(board.scrollWidth, board.offsetWidth), h: Math.max(board.scrollHeight, board.offsetHeight) });
      const top = frameEl.getBoundingClientRect().top;
      setFrame({
        w: frameEl.clientWidth,
        h: Math.max(240, window.innerHeight - top - 12),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    observer.observe(frameEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [rows, empty]);

  useEffect(() => {
    setScale((current) => (current < fit ? fit : current));
  }, [fit]);

  useEffect(() => {
    scaleRef.current = scale;
    fitRef.current = fit;
  }, [fit, scale]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const points = new Map<number, { x: number; y: number }>();
    let startDist = 0;
    let startScale = 1;
    const gap = () => {
      const [a, b] = [...points.values()];
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (event: PointerEvent) => {
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size === 2) {
        startDist = gap();
        startScale = scaleRef.current;
      }
    };
    const move = (event: PointerEvent) => {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (points.size < 2 || startDist <= 0) return;
      event.preventDefault();
      setScale(clampScale(startScale * (gap() / startDist), fitRef.current, 1));
    };
    const up = (event: PointerEvent) => {
      points.delete(event.pointerId);
      if (points.size < 2) startDist = 0;
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.06 : 0.06;
      setScale((current) => clampScale(current + delta, fitRef.current, 1));
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  const shown = clampScale(scale, fit, 1);

  return (
    <div className="mb-5">
      {zoomed ? (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost size-10 min-h-0 shrink-0 px-0"
            aria-label="Uitzoomen"
            disabled={shown <= fit + 0.01}
            onClick={() => setScale((current) => clampScale(current - 0.08, fit, 1))}
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            className="h-2 min-w-0 flex-1 accent-brass"
            min={fit}
            max={1}
            step={0.01}
            value={shown}
            aria-label="Zoom de piramide"
            onChange={(event) => setScale(clampScale(Number(event.target.value), fit, 1))}
          />
          <button
            type="button"
            className="btn btn-ghost size-10 min-h-0 shrink-0 px-0"
            aria-label="Inzoomen"
            disabled={shown >= 0.99}
            onClick={() => setScale((current) => clampScale(current + 0.08, fit, 1))}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className={cn("btn h-10 min-h-0 shrink-0 px-3 text-sm", shown <= fit + 0.02 ? "btn-brass" : "btn-ghost")}
            onClick={() => setScale(fit)}
          >
            Hele piramide
          </button>
        </div>
      ) : null}
      <div ref={frameRef} className="w-full overflow-x-auto pb-2" style={{ touchAction: "pan-x pan-y" }}>
        {empty ? <p className="panel px-4 py-6 text-sm text-ivory-dim">Nog niemand heeft de code gebruikt.</p> : null}
        <div
          className="relative mx-auto"
          style={{
            width: natural.w ? natural.w * shown : undefined,
            height: natural.h ? natural.h * shown : undefined,
          }}
        >
          <div
            ref={boardRef}
            className="absolute top-0 left-0 flex w-max flex-col items-center gap-3 px-2 py-2"
            style={{ transform: `scale(${shown})`, transformOrigin: "top left" }}
          >
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-2">
                {row.map((player) => {
                  const tilt = [-1.3, 1.1, -0.5, 1.4, -1, 0.7][(player.rank + rowIndex) % 6] ?? 0;
                  const activeNote = player.id === selectedId;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => onSelect(player.id)}
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
                          {player.stippen > 4 ? <span className="text-xs tabular-nums">{player.stippen}</span> : null}
                        </span>
                      ) : null}
                      {latest.get(player.id) ? (
                        <span className="mt-1 text-[10px] leading-tight font-semibold text-ink/80">
                          {latest.get(player.id)?.date}
                          <br />
                          {latest.get(player.id)?.line}
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
      </div>
    </div>
  );
}

function ShareSheet({
  label,
  title,
  description,
  text,
  url,
  compact = false,
}: {
  label: string;
  title: string;
  description: string;
  text: string;
  url: string;
  compact?: boolean;
}) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn("btn", compact ? "btn-ghost h-9 min-h-0 px-3 text-sm" : "btn-brass h-9 min-h-0 px-3 text-sm")}>
        <Share2 className="size-4" />
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
        <Dialog.Content className="sheet">
          <Dialog.Title className="font-display text-3xl italic">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink/70">{description}</Dialog.Description>
          <div className="mt-4 flex flex-col gap-2">
            <a className="btn btn-brass" href={whatsAppHref(text)}>
              WhatsApp
            </a>
            {canShare ? (
              <button
                type="button"
                className="btn btn-ivory"
                onClick={() => {
                  void navigator.share({ title, text, url }).catch(() => undefined);
                }}
              >
                Andere app
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(
                  () => toast.success("Link gekopieerd."),
                  () => toast(url),
                );
              }}
            >
              Kopieer link
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ShareLadder({ name, code }: { name: string; code: string }) {
  const url = joinUrl(code);
  return (
    <ShareSheet
      label="Delen"
      title={`Deel ${name}`}
      description="De ontvanger opent de link, logt in en doet mee."
      text={joinMessage(name, url)}
      url={url}
    />
  );
}

function PlayerPanel({
  player,
  me,
  range,
  amOwner,
  players,
  onChallenge,
  onInvite,
  onResult,
  onNudge,
  onRemove,
}: {
  player: Player;
  me: Player | null;
  range: number;
  amOwner: boolean;
  players: Player[];
  onChallenge: () => void;
  onInvite: () => void;
  onResult: (leftId: string, rightId: string, lockPair: boolean) => void;
  onNudge?: (direction: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const upward = me ? canChallengeUp(me.rank, player.rank, range) : false;
  const downward = me ? canInviteDown(me.rank, player.rank, range) : false;
  const betweenUs = me ? legalDistance(me.rank, player.rank, range) : false;
  const ownerOpponents = players.filter((other) => legalDistance(other.rank, player.rank, range));
  const places = me ? Math.abs(me.rank - player.rank) : 0;
  let hint = "Kies een actie, of tik een ander briefje.";
  if (me && player.id === me.id) hint = "Dit ben jij. Anderen kunnen jou uitdagen als ze dichtbij genoeg staan.";
  else if (upward) hint = `${player.name} staat ${places} ${places === 1 ? "plaats" : "plaatsen"} boven je.`;
  else if (downward) hint = `${player.name} staat ${places} ${places === 1 ? "plaats" : "plaatsen"} onder je.`;
  else if (me && player.rank < me.rank) hint = `${player.name} staat te ver boven je. Maximaal ${range} plaatsen.`;
  else if (me && player.rank > me.rank) hint = `${player.name} staat te ver onder je. Uitnodigen kan tot ${range} plaatsen.`;

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
          {downward ? (
            <button type="button" className="btn btn-brass" onClick={onInvite}>
              Uitnodigen
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
        </div>
      ) : null}
      {onRemove ? (
        <div className="mt-3">
          <button type="button" className="btn btn-ghost h-10 min-h-0 text-sm" onClick={onRemove}>
            <Trash2 className="size-4" /> Van de ladder
          </button>
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
  empty = "Nog geen uitdagingen. Tik iemand boven je aan om uit te dagen, of iemand onder je om uit te nodigen.",
}: {
  challenges: Challenge[];
  players: Player[];
  meId: string | null;
  amOwner: boolean;
  onRespond: (id: string, action: "accept" | "decline" | "cancel") => void;
  onResult: (challenge: Challenge) => void;
  empty?: string;
}) {
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "Onbekend";
  const [showPlayed, setShowPlayed] = useState(false);
  const played = challenges.filter((challenge) => challenge.status === "played");
  const shown = showPlayed ? challenges : challenges.filter((challenge) => challenge.status !== "played");
  if (challenges.length === 0) {
    return <p className="panel p-4 text-sm text-ivory-dim">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {played.length > 0 ? (
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={showPlayed} onChange={(event) => setShowPlayed(event.target.checked)} />
          Toon gespeelde uitdagingen
        </label>
      ) : null}
      {shown.length === 0 ? (
        <p className="panel p-4 text-sm text-ivory-dim">Geen open uitdagingen.</p>
      ) : (
    <ul className="flex flex-col gap-2">
      {shown.map((challenge) => {
        const mine = challenge.challengerId === meId;
        const againstMe = challenge.defenderId === meId;
        const open = challenge.status === "open" || challenge.status === "accepted";
        return (
          <li key={challenge.id} className="panel p-4">
            <p className="font-display text-xl italic">
              {(challenge.kind ?? "challenge") === "invite"
                ? `${name(challenge.challengerId)} nodigt ${name(challenge.defenderId)} uit`
                : `${name(challenge.challengerId)} daagt ${name(challenge.defenderId)} uit`}
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
      )}
    </div>
  );
}

function labelStatus(status: Challenge["status"]) {
  if (status === "open") return "open";
  if (status === "accepted") return "afgesproken";
  if (status === "declined") return "afgewezen";
  if (status === "played") return "gespeeld";
  return "ingetrokken";
}

function MatchList({
  matches,
  onEdit,
  canEdit,
  empty = "Nog geen partijen. De eerste uitslag komt hier te staan.",
}: {
  matches: Match[];
  onEdit?: (match: Match) => void;
  canEdit?: (match: Match) => boolean;
  empty?: string;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const cutoff = Date.now() - 6 * 24 * 60 * 60 * 1000;
  const recent = matches.filter((match) => new Date(match.playedAt).getTime() >= cutoff);
  const shown = showOlder ? matches : recent;
  if (matches.length === 0) {
    return <p className="panel p-4 text-sm text-ivory-dim">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {recent.length < matches.length ? (
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={showOlder} onChange={(event) => setShowOlder(event.target.checked)} />
          Oudere uitslagen
        </label>
      ) : null}
      {shown.length === 0 ? (
        <p className="panel p-4 text-sm text-ivory-dim">Geen uitslagen in de afgelopen 6 dagen.</p>
      ) : (
    <ul className="flex flex-col gap-2">
      {shown.map((match) => (
        <li key={match.id} className="panel flex flex-col gap-2 p-4">
          <p className="font-display text-xl italic">{matchSummary(match)}</p>
          <p className="text-sm text-ivory-dim">
            {fmtWhen(match.playedAt)}
            {match.note ? ` · ${match.note}` : ""}
          </p>
          {onEdit && canEdit?.(match) ? (
            <button type="button" className="btn btn-ghost h-10 min-h-0 self-start text-sm" onClick={() => onEdit(match)}>
              Wijzig score
            </button>
          ) : null}
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}

function TimesTab({
  players,
}: {
  players: Player[];
}) {
  return (
    <div className="flex flex-col gap-4">
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

function PlayersTab({
  players,
  bench,
  inviteCode,
  ladderName,
  onSelect,
  amOwner,
  onAdd,
  onReset,
  onRestore,
  mode,
}: {
  players: Player[];
  bench: Player[];
  inviteCode?: string;
  ladderName: string;
  onSelect: (id: string) => void;
  amOwner: boolean;
  onAdd?: (name: string) => void;
  onReset?: () => void;
  onRestore?: (id: string) => void;
  mode: "demo" | "live";
}) {
  const [name, setName] = useState("");
  const [onlyJoined, setOnlyJoined] = useState(false);
  const shown = onlyJoined ? players.filter((player) => player.userId) : players;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={onlyJoined}
          className={cn("btn h-10 min-h-0 text-sm", onlyJoined ? "btn-brass" : "btn-ghost")}
          onClick={() => setOnlyJoined((value) => !value)}
        >
          Alleen aangemeld
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="panel px-4 py-6 text-sm text-ivory-dim">Nog niemand heeft de code gebruikt.</p>
      ) : (
        <ol className="panel divide-y divide-line">
          {shown.map((player) => {
            const seatUrl = inviteCode ? joinUrl(inviteCode, player.id) : "";
            return (
              <li key={player.id} className="flex items-center gap-2 pr-2">
                <button
                  type="button"
                  onClick={() => onSelect(player.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="w-8 shrink-0 tabular-nums text-brass">{player.rank}</span>
                  <span className="font-display flex-1 truncate text-lg italic">{player.name}</span>
                  <span className="text-right text-sm text-ivory-dim">
                    {player.userId ? "aangemeld" : ""}
                    {player.userId && player.stippen > 0 ? " · " : ""}
                    {player.stippen > 0 ? `${player.stippen} stip` : ""}
                  </span>
                </button>
                {!player.userId && seatUrl ? (
                  <ShareSheet
                    compact
                    label="Link"
                    title={`Briefje van ${player.name}`}
                    description="Wie de link opent, wordt aan dit briefje gekoppeld."
                    text={seatMessage(ladderName, player.name, seatUrl)}
                    url={seatUrl}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {bench.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl italic">Naast de piramide</h2>
          <p className="text-sm text-ivory-dim">Het account en de naam blijven bewaard.</p>
          <ul className="panel divide-y divide-line">
            {bench.map((player) => (
              <li key={player.id} className="flex items-center gap-2 px-4 py-3">
                <span className="font-display flex-1 text-lg italic">{player.name}</span>
                <span className="text-sm text-ivory-dim">{player.userId ? "aangemeld" : "naam"}</span>
                {onRestore ? (
                  <button type="button" className="btn btn-brass h-10 min-h-0 text-sm" onClick={() => onRestore(player.id)}>
                    Terugzetten
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
  kind,
  onClose,
  onSubmit,
}: {
  defender: Player | null;
  me: Player | null;
  kind: "challenge" | "invite";
  onClose: () => void;
  onSubmit: (input: {
    defenderId: string;
    day: number | null;
    startMin: number | null;
    message: string;
    kind: "challenge" | "invite";
  }) => void;
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
            {kind === "invite" ? `Nodig ${defender?.name} uit` : `Daag ${defender?.name} uit`}
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
                onSubmit({ defenderId: defender.id, day: null, startMin: null, message, kind });
                return;
              }
              const slot = overlaps[Number(choice)];
              if (!slot) return;
              onSubmit({ defenderId: defender.id, day: slot.day, startMin: slot.startMin, message, kind });
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
              <p className="text-sm text-ink/70">
                {kind === "invite"
                  ? "Geen overlappende tijden. Nodig toch uit en spreek het zelf af."
                  : "Geen overlappende tijden. Daag toch uit en spreek het zelf af."}
              </p>
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
    matchId?: string;
  }) => void;
}) {
  const [leftScore, setLeftScore] = useState(draft?.leftScore ?? 1);
  const [rightScore, setRightScore] = useState(draft?.rightScore ?? 0);
  const [note, setNote] = useState(draft?.note ?? "");
  const left = players.find((player) => player.id === draft?.leftId) ?? null;
  const right = players.find((player) => player.id === draft?.rightId) ?? null;
  const wall = players.filter(isOnWall);
  const opponents =
    left && !draft?.lockPair
      ? wall.filter((player) => legalDistance(player.rank, left.rank, range))
      : [];
  const editing = Boolean(draft?.matchId);

  useEffect(() => {
    if (!draft) return;
    setLeftScore(draft.leftScore ?? 1);
    setRightScore(draft.rightScore ?? 0);
    setNote(draft.note ?? "");
  }, [draft]);

  const preview = useMemo(() => {
    if (!left || !right || !draft) return null;
    try {
      if (
        draft.matchId &&
        sameOutcome(draft.leftScore ?? 0, draft.rightScore ?? 0, leftScore, rightScore)
      ) {
        const draw = leftScore === rightScore;
        const leftWins = leftScore >= rightScore;
        return {
          winnerId: leftWins ? left.id : right.id,
          loserId: leftWins ? right.id : left.id,
          winnerName: leftWins ? left.name : right.name,
          loserName: leftWins ? right.name : left.name,
          winnerScore: leftWins ? leftScore : rightScore,
          loserScore: leftWins ? rightScore : leftScore,
          winnerRankBefore: left.rank,
          loserRankBefore: right.rank,
          swapped: false,
          stipAwarded: false,
          draw,
          players,
        };
      }
      if (draft.matchId) {
        return reviseMatch(
          players,
          {
            winnerId: draft.leftId,
            loserId: draft.rightId,
            swapped: Boolean(draft.swapped),
            stipAwarded: Boolean(draft.stipAwarded),
          },
          leftScore,
          rightScore,
        );
      }
      return settleMatch(wall, left.id, right.id, leftScore, rightScore, range);
    } catch {
      return null;
    }
  }, [draft, left, right, leftScore, rightScore, players, wall, range]);

  return (
    <Dialog.Root
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
        <Dialog.Content className="sheet">
          <Dialog.Title className="font-display text-3xl italic">{editing ? "Score wijzigen" : "Uitslag"}</Dialog.Title>
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
                  matchId: draft.matchId,
                })
              }
            >
              {editing ? "Score bijwerken" : "Vastleggen"}
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
