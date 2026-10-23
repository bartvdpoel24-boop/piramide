import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { authEnabled, GROK_PROVIDERS, signIn, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getLadder, listMyLadders, renameMe, setAvailability } from "@/lib/pyramid/api";
import { pyramidStats } from "@/lib/pyramid/stats";
import { StatsPanel } from "./stats-panel";
import { feedbackStatus, saveFeedbackToken } from "@/lib/pyramid/feedback";
import { useDemoStore } from "@/lib/pyramid/demo-store";
import type { LadderSummary, Player, Slot } from "@/lib/pyramid/types";
import { AvailabilityForm } from "./availability-form";
import { CreateForm } from "./create-form";

type View = "main" | "create" | "settings" | "stats" | "info";

const subscribeNothing = () => () => {};

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Er ging iets mis.";
}

export function AppMenu() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [signingOut, setSigningOut] = useState(false);
  const signedIn = Boolean(user && !user.isDevFallback);
  const ladderId = pathname.match(/^\/ladder\/([^/]+)/)?.[1] ?? null;
  const demo = pathname === "/demo" || pathname.startsWith("/demo/");
  const gateSession = useSyncExternalStore(subscribeNothing, hasGateSessionMarker, () => false);
  const showSignOut = signedIn && authEnabled && !gateSession;

  function close() {
    setOpen(false);
    setView("main");
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setView("main");
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-ghost size-11 px-0" aria-label="Menu">
          <Menu className="size-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-4 overflow-y-auto bg-felt px-4 pt-5 pb-8 text-ivory shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-3xl italic">
              {view === "create"
                ? "Nieuwe piramide"
                : view === "settings"
                  ? "Instellingen"
                  : view === "stats"
                    ? "Statistieken"
                    : view === "info"
                      ? "Info"
                      : "Menu"}
            </Dialog.Title>
            <Dialog.Close className="btn btn-ghost size-11 px-0" aria-label="Sluiten">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="absolute h-px w-px overflow-hidden">Navigatie en instellingen</Dialog.Description>
          {view === "main" ? (
            <nav className="flex flex-col gap-2">
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("create")}>
                Maak nieuwe piramide
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full justify-start"
                onClick={() => {
                  close();
                  void navigate({ to: "/demo" });
                }}
              >
                Ga naar demo modus
              </button>
              {showSignOut ? (
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-start"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    void signOut().catch((reason: unknown) => {
                      setSigningOut(false);
                      toast.error(errorText(reason));
                    });
                  }}
                >
                  {signingOut ? "Bezig…" : "Log uit"}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("settings")}>
                Instellingen
              </button>
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("stats")}>
                Statistieken
              </button>
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("info")}>
                Info
              </button>
            </nav>
          ) : null}
          {view === "create" ? (
            signedIn ? (
              <CreateForm
                onCreated={(id) => {
                  close();
                  void navigate({ to: "/ladder/$id", params: { id } });
                }}
              />
            ) : (
              <SignedOutNote />
            )
          ) : null}
          {view === "settings" ? <SettingsBody demo={demo} ladderId={ladderId} signedIn={signedIn} /> : null}
          {view === "stats" ? <StatsBody demo={demo} ladderId={ladderId} signedIn={signedIn} /> : null}
          {view === "info" ? <InfoBody /> : null}
          {view !== "main" ? (
            <button type="button" className="btn btn-ghost self-start" onClick={() => setView("main")}>
              Terug
            </button>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InfoBody() {
  const blocks = [
    ["De piramide", "Elk briefje is een plek. Hoe hoger, hoe beter. Het bovenste briefje is de troon."],
    ["Uitdagen", "Je daagt iemand uit die maximaal vier plaatsen boven je staat. Iemand onder je, tot vier plaatsen, nodig je uit."],
    ["Wisselen", "Win je van iemand boven je, dan wisselen jullie van plek. De rest blijft hangen."],
    ["Gelijkspel", "Bij een gelijkspel verandert er niets."],
    ["Stippen", "Houdt de nummer 1 stand, dan komt er een stip bij op de troon."],
    ["Deelnemen", "Met de code koppel je je naam aan een briefje. Aangemeld blijft staan, ook als je op dat moment niet ingelogd bent."],
    ["Tijden", "Zet wanneer je kunt spelen. Meerdere tijden op dezelfde dag mag."],
    ["Accepteren", "Alleen degene die uitgedaagd is, kan de uitdaging aannemen of afwijzen."],
  ];
  return (
    <div className="flex flex-col gap-4">
      {blocks.map(([title, body]) => (
        <section key={title}>
          <h2 className="font-display text-2xl italic">{title}</h2>
          <p className="text-sm text-ivory-dim">{body}</p>
        </section>
      ))}
    </div>
  );
}

function SignedOutNote() {
  const google = GROK_PROVIDERS.find((provider) => provider.idp === "google");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ivory-dim">Log in met Google om een piramide te maken.</p>
      {google ? (
        <button type="button" className="btn btn-ivory" onClick={() => void signIn(google.providerId, { callbackURL: "/" })}>
          Ga verder met Google
        </button>
      ) : null}
    </div>
  );
}

function StatsBody({
  demo,
  ladderId,
  signedIn,
}: {
  demo: boolean;
  ladderId: string | null;
  signedIn: boolean;
}) {
  const demoPlayers = useDemoStore((state) => state.players);
  const demoMatches = useDemoStore((state) => state.matches);
  const [live, setLive] = useState<{ name: string; stippen: number }[] | null>(null);
  const [matches, setMatches] = useState<ReturnType<typeof useDemoStore.getState>["matches"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    let active = true;
    const load = async () => {
      if (ladderId) {
        const snapshot = await getLadder({ data: ladderId });
        return { players: snapshot.players, matches: snapshot.matches };
      }
      if (!signedIn) return { players: [], matches: [] };
      const mine = await listMyLadders();
      const snapshots = await Promise.all(mine.ladders.map((ladder) => getLadder({ data: ladder.id })));
      return {
        players: snapshots.flatMap((snapshot) => snapshot.players),
        matches: snapshots.flatMap((snapshot) => snapshot.matches),
      };
    };
    load()
      .then((result) => {
        if (!active || !result) return;
        setLive(result.players);
        setMatches(result.matches);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, [demo, ladderId, signedIn]);

  if (demo) {
    return <StatsPanel stats={pyramidStats(demoPlayers, demoMatches)} />;
  }
  if (error) return <p className="text-sm text-brass">{error}</p>;
  if (!live || !matches) return <div className="panel h-24 animate-pulse" />;
  if (!ladderId && !signedIn) return <p className="text-sm text-ivory-dim">Open een piramide om de statistieken te zien.</p>;
  return <StatsPanel stats={pyramidStats(live, matches)} />;
}

function SettingsBody({
  demo,
  ladderId,
  signedIn,
}: {
  demo: boolean;
  ladderId: string | null;
  signedIn: boolean;
}) {
  if (demo) {
    return (
      <>
        <DemoSettings />
        {signedIn ? <FeedbackSettings /> : null}
      </>
    );
  }
  if (!signedIn) return <SignedOutNote />;
  return (
    <>
      <LiveSettings ladderId={ladderId} />
      <FeedbackSettings />
    </>
  );
}

function DemoSettings() {
  const players = useDemoStore((state) => state.players);
  const personaId = useDemoStore((state) => state.personaId);
  const me = players.find((player) => player.id === personaId) ?? null;
  if (!me) return <p className="text-sm text-ivory-dim">Geen speler gekozen.</p>;
  return (
    <PlayerSettings
      player={me}
      onRename={(name) => useDemoStore.getState().rename(name)}
      onAvailability={(slots) => useDemoStore.getState().setAvailability(slots)}
    />
  );
}

function LiveSettings({ ladderId }: { ladderId: string | null }) {
  const [ladders, setLadders] = useState<LadderSummary[] | null>(null);
  const [chosen, setChosen] = useState(ladderId ?? "");
  const [player, setPlayer] = useState<Player | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ladderId) return;
    let active = true;
    listMyLadders()
      .then((result) => {
        if (!active) return;
        const mine = result.ladders.filter((ladder) => ladder.myRank != null);
        setLadders(mine);
        setChosen(mine[0]?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, [ladderId]);

  const activeId = ladderId ?? chosen;

  useEffect(() => {
    if (!activeId) return;
    let active = true;
    setPlayer(undefined);
    getLadder({ data: activeId })
      .then((snapshot) => {
        if (!active) return;
        setPlayer(snapshot.players.find((item) => item.id === snapshot.meId) ?? null);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, [activeId]);

  if (error) return <p className="text-sm text-brass">{error}</p>;
  if (!ladderId && ladders == null) return <div className="panel h-24 animate-pulse" />;
  if (!activeId) {
    return <p className="text-sm text-ivory-dim">Je doet nog nergens mee. Maak een piramide of gebruik een code.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {!ladderId && ladders && ladders.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm">
          Piramide
          <select className="field" value={chosen} onChange={(event) => setChosen(event.target.value)}>
            {ladders.map((ladder) => (
              <option key={ladder.id} value={ladder.id}>
                {ladder.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {player ? (
        <PlayerSettings
          key={`${player.id}:${player.name}:${player.availability.map((slot) => `${slot.day}-${slot.startMin}`).join(",")}`}
          player={player}
          onRename={async (name) => {
            await renameMe({ data: { ladderId: activeId, name } });
            setPlayer({ ...player, name });
            window.dispatchEvent(new Event("piramide-refresh"));
          }}
          onAvailability={async (slots) => {
            await setAvailability({ data: { ladderId: activeId, slots } });
            setPlayer({ ...player, availability: slots });
            window.dispatchEvent(new Event("piramide-refresh"));
          }}
        />
      ) : player === undefined ? (
        <div className="panel h-24 animate-pulse" />
      ) : (
        <p className="text-sm text-ivory-dim">
          Je naam staat nog niet op deze piramide. Koppel een briefje, dan kun je naam en tijden hier zetten.
        </p>
      )}
    </div>
  );
}

function PlayerSettings({
  player,
  onRename,
  onAvailability,
}: {
  player: Player;
  onRename: (name: string) => void | Promise<void>;
  onAvailability: (slots: Slot[]) => void | Promise<void>;
}) {
  const [name, setName] = useState(player.name);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          Promise.resolve(onRename(name))
            .then(() => toast.success("Naam gewijzigd."))
            .catch((reason: unknown) => setError(errorText(reason)));
        }}
      >
        <h2 className="font-display text-2xl italic">Naam wijzigen</h2>
        <label className="flex flex-col gap-1 text-sm">
          Jouw naam
          <input className="field" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </label>
        {error ? <p className="text-sm text-brass">{error}</p> : null}
        <button type="submit" className="btn btn-brass self-start" disabled={name.trim() === player.name}>
          Bewaren
        </button>
      </form>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Beschikbaarheid</h2>
        <AvailabilityForm
          player={player}
          onSave={(slots) => {
            Promise.resolve(onAvailability(slots))
              .then(() => toast.success("Tijden bewaard."))
              .catch((reason: unknown) => toast.error(errorText(reason)));
          }}
        />
      </div>
    </div>
  );
}

function FeedbackSettings() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [canConfigure, setCanConfigure] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    feedbackStatus()
      .then((status) => {
        if (!active) return;
        setReady(status.ready);
        setCanConfigure(status.canConfigure);
      })
      .catch(() => {
        if (active) setReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (ready == null) return <div className="panel h-16 animate-pulse" />;
  if (!canConfigure && ready) return null;

  return (
    <form
      className="flex flex-col gap-2 border-t border-line pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        saveFeedbackToken({ data: { token } })
          .then(() => {
            setReady(true);
            setToken("");
            toast.success("Meldingen staan aan.");
          })
          .catch((reason: unknown) => setError(errorText(reason)))
          .finally(() => setBusy(false));
      }}
    >
      <h2 className="font-display text-2xl italic">Meldingen</h2>
      <p className="text-sm text-ivory-dim">
        {ready
          ? "Een melding via Geef feedback wordt een GitHub-issue."
          : "Nog uit. Plak een GitHub-token met schrijfrecht op issues van de piramide-repo."}
      </p>
      {canConfigure ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            GitHub-token
            <input
              className="field"
              type="password"
              value={token}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setToken(event.target.value)}
              placeholder={ready ? "Token vervangen" : "ghp_… of github_pat_…"}
            />
          </label>
          {error ? <p className="text-sm text-brass">{error}</p> : null}
          <button type="submit" className="btn btn-brass self-start" disabled={busy || token.trim().length < 20}>
            {busy ? "Bezig…" : ready ? "Token vervangen" : "Meldingen aanzetten"}
          </button>
        </>
      ) : (
        <p className="text-sm text-ivory-dim">Alleen Bart kan dit aanzetten.</p>
      )}
    </form>
  );
}
