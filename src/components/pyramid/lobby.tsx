import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createLadder, joinLadder, listMyLadders, previewInvite } from "@/lib/pyramid/api";
import type { InvitePreview, LadderSummary } from "@/lib/pyramid/types";
import { WALL } from "@/lib/pyramid/roster";
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
        {isPending ? (
          <div className="h-8 w-24 animate-pulse rounded-full bg-baize" />
        ) : user ? (
          <UserButton />
        ) : null}
      </header>

      <section className="mb-8 max-w-xl">
        <h1 className="font-display text-5xl italic leading-tight">De ladder naast de pooltafel.</h1>
        <p className="mt-3 text-ivory-dim">
          Briefjes op een piramide. Je daagt iemand uit die maximaal vier plaatsen boven je staat. Win je,
          dan wissel je. Houdt de nummer 1 stand, dan een stip op de troon.
        </p>
      </section>

      <ul className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Uitdagen", "Tot vier plaatsen omhoog. De ander accepteert, of je spreekt het zelf af."],
          ["Wisselen", "De winnaar pakt de hogere plek. Verder schuift er niets."],
          ["Stippen", "Elke geslaagde verdediging van plek 1 is een stip."],
        ].map(([title, body]) => (
          <li key={title} className="panel p-4">
            <h2 className="font-display text-2xl italic">{title}</h2>
            <p className="mt-1 text-sm text-ivory-dim">{body}</p>
          </li>
        ))}
      </ul>

      {isPending ? <div className="panel h-40 animate-pulse" /> : user ? <SignedIn /> : <SignedOut />}
    </Shell>
  );
}

function SignedOut() {
  return (
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
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    let active = true;
    listMyLadders()
      .then((rows) => {
        if (active) setLadders(rows);
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
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-brass" onClick={() => setMode(mode === "create" ? null : "create")}>
          Nieuwe piramide
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === "join" ? null : "join")}>
          Deelnemen met code
        </button>
        <Link to="/demo" className="btn btn-ghost">
          Demo
        </Link>
      </div>
      {mode === "create" ? (
        <CreateForm
          onCreated={(id) => void navigate({ to: "/ladder/$id", params: { id } })}
        />
      ) : null}
      {mode === "join" ? (
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

function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("Kantoorpiramide");
  const [importWall, setImportWall] = useState(true);
  const [claim, setClaim] = useState("Bart van der Poel");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const claimName = importWall ? (claim === "__new" ? custom : claim) : custom || claim;
        setBusy(true);
        setError(null);
        createLadder({ data: { name, importWall, claimName } })
          .then((result) => onCreated(result.id))
          .catch((reason: unknown) => {
            setError(errorText(reason));
            setBusy(false);
          });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Naam van de piramide
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={importWall} onChange={(event) => setImportWall(event.target.checked)} />
        Begin met de namen van de muur
      </label>
      {importWall ? (
        <label className="flex flex-col gap-1 text-sm">
          Welk briefje ben jij?
          <select className="field" value={claim} onChange={(event) => setClaim(event.target.value)}>
            {WALL.map((person) => (
              <option key={person.id} value={person.name}>
                {person.name}
              </option>
            ))}
            <option value="__new">Ik sta er nog niet bij</option>
          </select>
        </label>
      ) : null}
      {!importWall || claim === "__new" ? (
        <label className="flex flex-col gap-1 text-sm">
          Jouw naam
          <input className="field" value={custom} onChange={(event) => setCustom(event.target.value)} required />
        </label>
      ) : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      <button type="submit" className="btn btn-brass self-start" disabled={busy}>
        {busy ? "Bezig…" : "Piramide openen"}
      </button>
    </form>
  );
}

function JoinForm({ onJoined }: { onJoined: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [playerId, setPlayerId] = useState<string | "new">("new");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            setCode(event.target.value);
            setPreview(null);
          }}
          autoCapitalize="characters"
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
