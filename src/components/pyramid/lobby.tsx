import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { homeFeed, joinLadder, listMyLadders, previewInvite } from "@/lib/pyramid/api";
import { challengeWhen, fmtWhen, matchSummary } from "@/lib/pyramid/format";
import { currentMonthLabel, monthWinShare, type StatRow } from "@/lib/pyramid/stats";
import { useDemoStore } from "@/lib/pyramid/demo-store";
import type { HomeChallenge, HomeMatch, InvitePreview, LadderSummary } from "@/lib/pyramid/types";
import { WinPie } from "./stats-panel";
import { RackMark } from "./mark";
import { Shell } from "./shell";
import { Splash } from "./splash";

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Er ging iets mis.";
}

export function Lobby() {
  return (
    <>
      <Splash />
      <LobbyBody />
    </>
  );
}

function LobbyBody() {
  const { user, isPending } = useCurrentUserState();
  return (
    <Shell>
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RackMark className="h-10 w-12" />
          <div>
            <p className="text-xs font-semibold tracking-widest text-brass uppercase">Pool ladder</p>
            <p className="font-display text-2xl italic leading-none">Piramide</p>
          </div>
        </div>
        {isPending ? <div className="h-8 w-24 animate-pulse rounded-full bg-baize" /> : null}
      </header>

      {isPending ? <div className="panel h-40 animate-pulse" /> : user ? <SignedIn /> : <SignedOut />}
    </Shell>
  );
}

function DemoActivity() {
  const players = useDemoStore((state) => state.players);
  const challenges = useDemoStore((state) => state.challenges);
  const matches = useDemoStore((state) => state.matches);
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "Onbekend";
  const open = challenges.filter((item) => item.status === "open" || item.status === "accepted");
  return (
    <ActivityBoard
      monthWins={monthWinShare(matches)}
      challenges={open.map((item) => ({
        id: item.id,
        ladderId: null,
        title:
          item.kind === "invite"
            ? `${name(item.challengerId)} nodigt ${name(item.defenderId)} uit`
            : `${name(item.challengerId)} daagt ${name(item.defenderId)} uit`,
        detail: `${item.status === "accepted" ? "afgesproken" : "open"} · ${challengeWhen(item)}`,
      }))}
      matches={matches.slice(0, 4).map((item) => ({
        id: item.id,
        ladderId: null,
        title: matchSummary(item),
        detail: fmtWhen(item.playedAt),
      }))}
    />
  );
}

function ActivityBoard({
  challenges,
  matches,
  monthWins,
  loading = false,
}: {
  challenges: { id: string; ladderId: string | null; title: string; detail: string }[];
  matches: { id: string; ladderId: string | null; title: string; detail: string }[];
  monthWins: StatRow[];
  loading?: boolean;
}) {
  if (loading) return <div className="panel h-24 animate-pulse" />;
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Winsten in {currentMonthLabel()}</h2>
        <WinPie rows={monthWins} empty="Deze maand nog geen winst." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Uitdagingen</h2>
        {challenges.length === 0 ? (
          <p className="panel p-4 text-sm text-ivory-dim">Geen open uitdagingen.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {challenges.map((item) => (
              <li key={item.id}>
                {item.ladderId ? (
                  <Link to="/ladder/$id" params={{ id: item.ladderId }} className="panel block p-4">
                    <span className="font-display block text-xl italic">{item.title}</span>
                    <span className="text-sm text-ivory-dim">{item.detail}</span>
                  </Link>
                ) : (
                  <Link to="/demo" className="panel block p-4">
                    <span className="font-display block text-xl italic">{item.title}</span>
                    <span className="text-sm text-ivory-dim">{item.detail}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Recente uitslagen</h2>
        {matches.length === 0 ? (
          <p className="panel p-4 text-sm text-ivory-dim">Nog geen uitslagen.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((item) => (
              <li key={item.id}>
                {item.ladderId ? (
                  <Link to="/ladder/$id" params={{ id: item.ladderId }} className="panel block p-4">
                    <span className="font-display block text-xl italic">{item.title}</span>
                    <span className="text-sm text-ivory-dim">{item.detail}</span>
                  </Link>
                ) : (
                  <Link to="/demo" className="panel block p-4">
                    <span className="font-display block text-xl italic">{item.title}</span>
                    <span className="text-sm text-ivory-dim">{item.detail}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="flex flex-col gap-6">
      <DemoActivity />
      <div className="grid gap-3 sm:grid-cols-2">
      <Link to="/demo" className="panel flex flex-col gap-3 p-5">
        <span className="text-xs font-semibold tracking-widest text-brass uppercase">Zonder account</span>
        <span className="font-display text-3xl italic">Speel de demo</span>
        <span className="text-sm text-ivory-dim">
          De namen van de muur, inclusief uitdagen en uitslagen. Blijft op dit apparaat.
        </span>
        <span className="btn btn-brass mt-2 self-start">Naar de demo</span>
      </Link>
      <div className="panel flex flex-col gap-3 p-5">
        <span className="text-xs font-semibold tracking-widest text-brass uppercase">Met het team</span>
        <span className="font-display text-3xl italic">Echte ladder</span>
        <span className="text-sm text-ivory-dim">
          Log in met Google. Maak een piramide, deel de code, en houd partijen bij.
        </span>
        <SignInButtons />
      </div>
    </div>
    </div>
  );
}

export function SignInButtons({ callback = "/" }: { callback?: string }) {
  const google = GROK_PROVIDERS.find((provider) => provider.idp === "google");
  const rest = GROK_PROVIDERS.filter((provider) => provider.idp !== "google");
  return (
    <div className="flex flex-col gap-2">
      {google ? (
        <button
          type="button"
          className="btn btn-ivory"
          onClick={() => void signIn(google.providerId, { callbackURL: callback })}
        >
          Ga verder met Google
        </button>
      ) : null}
      {rest.map((provider) => (
        <button
          key={provider.providerId}
          type="button"
          className="btn btn-ghost"
          onClick={() => void signIn(provider.providerId, { callbackURL: callback })}
        >
          Ga verder met {provider.label}
        </button>
      ))}
    </div>
  );
}

function SignedIn() {
  const navigate = useNavigate();
  const [ladders, setLadders] = useState<LadderSummary[] | null>(null);
  const [canJoin, setCanJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"join" | null>(null);

  const [feed, setFeed] = useState<{ challenges: HomeChallenge[]; matches: HomeMatch[]; monthWins: StatRow[] } | null>(null);

  useEffect(() => {
    let active = true;
    listMyLadders()
      .then((result) => {
        if (!active) return;
        setLadders(result.ladders);
        setCanJoin(result.canJoin);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    homeFeed()
      .then((result) => {
        if (active) setFeed(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ActivityBoard
        loading={feed == null && !error}
        monthWins={feed?.monthWins ?? []}
        challenges={(feed?.challenges ?? []).map((item) => ({
          id: item.id,
          ladderId: item.ladderId,
          title:
            item.kind === "invite"
              ? `${item.challengerName} nodigt ${item.defenderName} uit`
              : `${item.challengerName} daagt ${item.defenderName} uit`,
          detail: `${item.ladderName} · ${item.status === "accepted" ? "afgesproken" : "open"}`,
        }))}
        matches={(feed?.matches ?? []).map((item) => ({
          id: item.id,
          ladderId: item.ladderId,
          title: matchSummary({
            id: item.id,
            winnerId: null,
            loserId: null,
            winnerName: item.winnerName,
            loserName: item.loserName,
            winnerScore: item.winnerScore,
            loserScore: item.loserScore,
            winnerRankBefore: item.winnerRankBefore,
            loserRankBefore: item.loserRankBefore,
            swapped: item.swapped,
            stipAwarded: item.stipAwarded,
            playedAt: item.playedAt,
            note: "",
            challengeId: null,
          }),
          detail: `${item.ladderName} · ${fmtWhen(item.playedAt)}`,
        }))}
      />
      {canJoin ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === "join" ? null : "join")}>
            Deelnemen met code
          </button>
        </div>
      ) : null}
      {mode === "join" && canJoin ? (
        <JoinForm onJoined={(id) => void navigate({ to: "/ladder/$id", params: { id } })} />
      ) : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      {ladders == null && !error ? <div className="panel h-24 animate-pulse" /> : null}
      {ladders && ladders.length === 0 ? (
        <p className="panel p-4 text-sm text-ivory-dim">
          Je staat nog op geen enkele ladder. Maak er een, of gebruik de code van een collega.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {ladders?.map((ladder) => (
          <li key={ladder.id}>
            <Link to="/ladder/$id" params={{ id: ladder.id }} className="panel flex items-center justify-between gap-3 p-4">
              <span>
                <span className="font-display block text-2xl italic">{ladder.name}</span>
                <span className="text-sm text-ivory-dim">
                  {ladder.kingName ? `Troon: ${ladder.kingName}` : "Nog geen koning"}
                  {ladder.myRank ? ` · jij op ${ladder.myRank}` : ""}
                  {` · ${ladder.playerCount} spelers`}
                </span>
              </span>
              {ladder.openChallenges > 0 ? (
                <span className="rounded-full bg-brass px-2 py-1 text-xs font-semibold text-ink">
                  {ladder.openChallenges} open
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JoinForm({
  onJoined,
  initialCode = "",
  locked = false,
}: {
  onJoined: (id: string) => void;
  initialCode?: string;
  locked?: boolean;
}) {
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [playerId, setPlayerId] = useState<string | "new">("new");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initialCode) return;
    let active = true;
    setBusy(true);
    previewInvite({ data: initialCode })
      .then((result) => {
        if (!active) return;
        setPreview(result);
        if (result.alreadyIn) {
          onJoined(result.id);
          return;
        }
        const open = result.players.find((player) => !player.claimed);
        setPlayerId(open?.id ?? "new");
        setBusy(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(errorText(reason));
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [initialCode, onJoined]);

  return (
    <form
      className="panel flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setBusy(true);
        if (!preview) {
          previewInvite({ data: code })
            .then((result) => {
              setPreview(result);
              if (result.alreadyIn) {
                onJoined(result.id);
                return;
              }
              const open = result.players.find((player) => !player.claimed);
              setPlayerId(open?.id ?? "new");
              setBusy(false);
            })
            .catch((reason: unknown) => {
              setError(errorText(reason));
              setBusy(false);
            });
          return;
        }
        joinLadder({
          data: {
            code,
            playerId: playerId === "new" ? null : playerId,
            name: playerId === "new" ? name : "",
          },
        })
          .then((result) => onJoined(result.id))
          .catch((reason: unknown) => {
            setError(errorText(reason));
            setBusy(false);
          });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Uitnodigingscode
        <input
          className="field uppercase"
          value={code}
          onChange={(event) => {
            if (locked) return;
            setCode(event.target.value);
            setPreview(null);
          }}
          autoCapitalize="characters"
          readOnly={locked}
          required
        />
      </label>
      {preview && !preview.alreadyIn ? (
        <>
          <p className="text-sm text-ivory-dim">
            {preview.name} · {preview.playerCount} spelers. Koppel je naam of schrijf je onderaan in.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Jouw briefje
            <select className="field" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {preview.players
                .filter((player) => !player.claimed)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.rank}. {player.name}
                  </option>
                ))}
              <option value="new">Nieuwe naam, onderaan</option>
            </select>
          </label>
          {playerId === "new" ? (
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Je naam"
              required
              aria-label="Je naam"
            />
          ) : null}
        </>
      ) : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      <button type="submit" className="btn btn-brass self-start" disabled={busy}>
        {busy ? "Bezig…" : preview ? "Inschrijven" : "Code bekijken"}
      </button>
    </form>
  );
}
