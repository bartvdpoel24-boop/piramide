import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { authEnabled, GROK_PROVIDERS, signIn, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getLadder, listMyLadders, renameMe, setAvailability, setNoteColor, setNotifyEmail, databaseStatus, exportLadderBackup, restoreLadderBackup } from "@/lib/pyramid/api";
import { cn } from "@/lib/cn";
import { NOTE_BG, NOTE_LABEL } from "@/lib/pyramid/notes";
import { NOTE_COLORS, type Challenge, type Match, type NoteColor, type Player, type Slot } from "@/lib/pyramid/types";
import { pyramidStats, headToHead } from "@/lib/pyramid/stats";
import { fmtWhen } from "@/lib/pyramid/format";
import { StatsPanel } from "./stats-panel";
import { useDemoStore } from "@/lib/pyramid/demo-store";
import type { LadderSummary } from "@/lib/pyramid/types";
import { AvailabilityForm } from "./availability-form";
import { CreateForm } from "./create-form";
import { ELO_K, ELO_START, eloDeltas, fmtEloDelta } from "@/lib/pyramid/elo";
import { VERSION, RELEASES } from "@/lib/pyramid/version";

type View = "main" | "create" | "settings" | "stats" | "h2h" | "info" | "regels" | "versie";

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
                    : view === "h2h"
                      ? "Head to head"
                      : view === "info"
                        ? "Info"
                        : view === "regels"
                          ? "Poolregels"
                          : view === "versie"
                            ? "Versie"
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
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("h2h")}>
                Head to head
              </button>
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("info")}>
                Info
              </button>
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("regels")}>
                Poolregels
              </button>
              <button type="button" className="btn btn-ghost w-full justify-start" onClick={() => setView("versie")}>
                Versie
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
          {view === "h2h" ? <HeadToHead demo={demo} ladderId={ladderId} signedIn={signedIn} /> : null}
          {view === "info" ? <InfoBody /> : null}
          {view === "regels" ? <RulesBody /> : null}
          {view === "versie" ? <VersionBody /> : null}
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

function RulesBody() {
  const blocks = [
    ["Het spel", "8-ball. Eerst je groep weg: de hele ballen 1 tot en met 7, of de strepen 9 tot en met 15. Daarna de zwarte 8 in de pocket die je geroepen hebt."],
    ["Pocket callen", "Vóór elke stoot zeg je welke bal in welke pocket gaat. Hoe, via band of andere bal, hoef je niet te zeggen. De break hoef je niet te callen."],
    ["Verkeerde pocket", "Valt de bal in een ander gat, dan blijft hij weg. De beurt gaat over. Dat is geen fout. Mis je, dan mag je die bal de volgende beurt in een ander gat callen."],
    ["Open tafel", "Na de break is de tafel open, ook als er al een bal in is gegaan. Heel of streep staat pas vast als iemand ná de break een gecallde bal goed pot. Zolang het open is, mag je ook via de 8 een andere bal callen."],
    ["De break", "De witte begint achter de lijn. Er moet een bal in, of minstens vier ballen moeten de kopband raken. Pot je iets, dan ga je door. Anders is de ander aan de beurt."],
    ["Acht op de break", "Pot je de 8 bij de break, dan kies je: opnieuw breaken, of de 8 terug op de stip. Je blijft aan de beurt. Gaat de witte bij de break van tafel, dan heeft de ander ball-in-hand achter de lijn."],
    ["Fout", "Witte of een bal van tafel. De witte niet met de pomerans raken, twee keer raken of duwen. Geen band raken nadat je een bal hebt geraakt, zonder dat er iets in gaat. Een fout is ball-in-hand: de witte mag overal. Een speler is nooit twee keer achter elkaar aan de beurt door een fout. Ballen die van tafel zijn of bij een fout in zijn gegaan, komen niet terug."],
    ["De acht verliest", "Je verliest het frame als je de 8 pot én een fout maakt, de 8 in dezelfde stoot als je laatste groepsbal pot, de 8 van tafel speelt, de 8 in een andere pocket dan geroepen pot, of de 8 pot terwijl je een andere bal had gecalled. Een fout waarbij de 8 op tafel blijft, is geen verlies."],
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ivory-dim">Call-shot 8-ball. Elke bal én de pocket zeg je van tevoren.</p>
      {blocks.map(([title, body]) => (
        <section key={title}>
          <h2 className="font-display text-2xl italic">{title}</h2>
          <p className="text-sm text-ivory-dim">{body}</p>
        </section>
      ))}
    </div>
  );
}

function VersionBody() {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-6xl italic leading-none">{VERSION}</p>
      <ol className="flex flex-col gap-4">
        {RELEASES.map((release) => (
          <li key={release.version} className="border-t border-line pt-3">
            <p className="font-display text-xl italic">Versie {release.version}</p>
            <p className="text-xs text-ivory-dim">{release.date}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {release.notes.map((note) => (
                <li key={note} className="text-sm text-ivory-dim">
                  {note}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InfoBody() {
  const blocks = [
    ["De piramide", "Elk briefje is een plek. Hoe hoger, hoe beter. Het bovenste briefje is de troon."],
    ["Uitdagen", "Je kunt iedereen uitdagen, en iedereen kan jou uitdagen. De Elo wijzigt bij elke uitslag."],
    ["Wisselen", "De piramide schuift alleen volgens de piramideregels: win je van iemand tot vier plaatsen boven je, dan wisselen jullie van plek. Sta je verder uit elkaar, of win je van iemand onder je, dan blijven de briefjes hangen."],
    ["Gelijkspel", "Bij een gelijkspel verandert er niets."],
    ["Stippen", "Houdt de nummer 1 stand, dan komt er een stip bij op de troon."],
    [
      "Elo",
      `Naast de plek heeft iedereen een Elo-rating. Iedereen begint op ${ELO_START}. Na elke uitslag wordt die opnieuw berekend uit alle partijen, op datum. De verwachte score is 1 gedeeld door (1 + 10 tot de macht (tegenstander min jij) gedeeld door 400). De nieuwe rating is de oude plus ${ELO_K} keer (echte score min verwachte score). Winst telt als 1, verlies als 0 en gelijkspel als 0,5. Winnen van iemand met een hogere rating levert dus meer op dan winnen van iemand met een lagere.`,
    ],
    [
      "Elo bij een groep",
      `Bij meer dan twee spelers vergelijken we elk paar op score. De factor ${ELO_K} delen we door het aantal spelers min één, zodat een grote partij ongeveer even zwaar weegt als een gewone. Vrij spelen telt mee voor de Elo, niet voor de piramide. Een gewijzigde score herberekent de rating.`,
    ],
    ["Deelnemen", "Deel de link, bijvoorbeeld via WhatsApp. De ontvanger opent hem, logt in en koppelt een naam. Met de code kan dat ook."],
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

function HeadToHead({
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
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [matches, setMatches] = useState<typeof demoMatches | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  useEffect(() => {
    if (demo) {
      setPlayers(demoPlayers.filter((player) => player.active !== false && player.rank > 0));
      setMatches(demoMatches);
      return;
    }
    if (!ladderId && !signedIn) return;
    let active = true;
    const load = async () => {
      if (ladderId) return getLadder({ data: ladderId });
      const mine = await listMyLadders();
      const first = mine.ladders.find((ladder) => ladder.myRank != null) ?? mine.ladders[0];
      if (!first) return null;
      return getLadder({ data: first.id });
    };
    load()
      .then((snapshot) => {
        if (!active) return;
        const wall = (snapshot?.players ?? []).filter((player) => player.active !== false && player.rank > 0);
        setPlayers(wall);
        setMatches(snapshot?.matches ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, [demo, ladderId, signedIn, demoPlayers, demoMatches]);

  const wall = players ?? [];
  const left = leftId || wall[0]?.id || "";
  const right = rightId || wall.find((player) => player.id !== left)?.id || "";
  const leftPlayer = wall.find((player) => player.id === left);
  const rightPlayer = wall.find((player) => player.id === right);
  const compared = matches && left && right && left !== right ? headToHead(matches, left, right) : null;
  const swings = matches ? eloDeltas(matches) : null;

  if (!demo && !ladderId && !signedIn) {
    return <p className="text-sm text-ivory-dim">Open een piramide om twee spelers te vergelijken.</p>;
  }
  if (error) return <p className="text-sm text-brass">{error}</p>;
  if (!players || !matches) return <div className="panel h-24 animate-pulse" />;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Speler
        <select className="field" value={left} onChange={(event) => setLeftId(event.target.value)}>
          {wall.map((player) => (
            <option key={player.id} value={player.id}>
              {player.rank}. {player.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tegen
        <select className="field" value={right} onChange={(event) => setRightId(event.target.value)}>
          {wall.map((player) => (
            <option key={player.id} value={player.id}>
              {player.rank}. {player.name}
            </option>
          ))}
        </select>
      </label>
      {compared && leftPlayer && rightPlayer ? (
        <>
          <p className="font-display text-2xl italic">
            Totaal {leftPlayer.name} {compared.leftTotal} – {compared.rightTotal} {rightPlayer.name}
          </p>
          {compared.lines.length === 0 ? (
            <p className="text-sm text-ivory-dim">Deze twee hebben nog niet tegen elkaar gespeeld.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {compared.lines.map((line) => (
                <li key={line.id} className="panel p-3 text-sm">
                  <span className="text-ivory-dim">{fmtWhen(line.playedAt)}</span>
                  <span className="mt-1 block font-display text-lg italic">
                    {leftPlayer.name} {line.left} – {line.right} {rightPlayer.name}{" "}
                    <span className="tabular-nums">
                      {fmtEloDelta(swings?.get(line.id)?.get(leftPlayer.id) ?? 0)} /{" "}
                      {fmtEloDelta(swings?.get(line.id)?.get(rightPlayer.id) ?? 0)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-ivory-dim">Kies twee verschillende spelers.</p>
      )}
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
  if (demo) return <DemoSettings />;
  if (!signedIn) return <SignedOutNote />;
  return <LiveSettings ladderId={ladderId} />;
}

function DemoSettings() {
  const players = useDemoStore((state) => state.players);
  const personaId = useDemoStore((state) => state.personaId);
  const me = players.find((player) => player.id === personaId) ?? null;
  if (!me) return <p className="text-sm text-ivory-dim">Geen speler gekozen.</p>;
  return (
    <div className="flex flex-col">
      <PlayerSettings
        player={me}
        onRename={(name) => useDemoStore.getState().rename(name)}
        onEmail={(email) => useDemoStore.getState().setEmail(email)}
        onColor={(color) => useDemoStore.getState().setNote(color)}
        onAvailability={(slots) => useDemoStore.getState().setAvailability(slots)}
      />
      <Fold title="Backup">
        <DemoBackup />
      </Fold>
      <Fold title="Database">
        <DatabasePanel demo />
      </Fold>
    </div>
  );
}

function LiveSettings({ ladderId }: { ladderId: string | null }) {
  const [ladders, setLadders] = useState<LadderSummary[] | null>(null);
  const [chosen, setChosen] = useState(ladderId ?? "");
  const [player, setPlayer] = useState<Player | null | undefined>(undefined);
  const [amOwner, setAmOwner] = useState(false);
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
        setAmOwner(snapshot.amOwner);
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
    <div className="flex flex-col">
      {!ladderId && ladders && ladders.length > 1 ? (
        <label className="mb-3 flex flex-col gap-1 text-sm">
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
          key={`${player.id}:${player.name}:${player.note}:${player.email ?? ""}:${player.availability.map((slot) => `${slot.day}-${slot.startMin}`).join(",")}`}
          player={player}
          onRename={async (name) => {
            await renameMe({ data: { ladderId: activeId, name } });
            setPlayer({ ...player, name });
            window.dispatchEvent(new Event("piramide-refresh"));
          }}
          onEmail={async (email) => {
            await setNotifyEmail({ data: { ladderId: activeId, email } });
            setPlayer({ ...player, email });
          }}
          onColor={async (color) => {
            await setNoteColor({ data: { ladderId: activeId, color } });
            setPlayer({ ...player, note: color });
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
      <Fold title="Backup">
        <LiveBackup ladderId={activeId} amOwner={amOwner} />
      </Fold>
      <Fold title="Database">
        <DatabasePanel />
      </Fold>
    </div>
  );
}

function PlayerSettings({
  player,
  onRename,
  onEmail,
  onColor,
  onAvailability,
}: {
  player: Player;
  onRename: (name: string) => void | Promise<void>;
  onEmail: (email: string) => void | Promise<void>;
  onColor: (color: NoteColor) => void | Promise<void>;
  onAvailability: (slots: Slot[]) => void | Promise<void>;
}) {
  const [name, setName] = useState(player.name);
  const [email, setEmail] = useState(player.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <Fold title="Naam wijzigen">
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
          <label className="flex flex-col gap-1 text-sm">
            Jouw naam
            <input className="field" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          </label>
          {error ? <p className="text-sm text-brass">{error}</p> : null}
          <button type="submit" className="btn btn-brass self-start" disabled={name.trim() === player.name}>
            Bewaren
          </button>
        </form>
      </Fold>
      <Fold title="E-mailadres">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setMailError(null);
            Promise.resolve(onEmail(email))
              .then(() => toast.success(email.trim() ? "E-mailadres bewaard." : "E-mailadres verwijderd."))
              .catch((reason: unknown) => setMailError(errorText(reason)));
          }}
        >
          <p className="text-sm text-ivory-dim">Als iemand je uitdaagt, krijg je daar een mail.</p>
          <label className="flex flex-col gap-1 text-sm">
            Jouw e-mail
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              maxLength={120}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="naam@voorbeeld.nl"
            />
          </label>
          {mailError ? <p className="text-sm text-brass">{mailError}</p> : null}
          <button type="submit" className="btn btn-brass self-start" disabled={email.trim() === (player.email ?? "")}>
            Bewaren
          </button>
        </form>
      </Fold>
      <Fold title="Kleur van je briefje">
        <div className="flex flex-wrap gap-2">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={NOTE_LABEL[color]}
              aria-pressed={player.note === color}
              title={NOTE_LABEL[color]}
              className={cn(
                "size-11 rounded-md ring-2 ring-offset-2 ring-offset-felt",
                player.note === color ? "ring-brass" : "ring-transparent",
              )}
              style={{ background: NOTE_BG[color] }}
              onClick={() => {
                if (color === player.note) return;
                Promise.resolve(onColor(color))
                  .then(() => toast.success("Kleur gewijzigd."))
                  .catch((reason: unknown) => toast.error(errorText(reason)));
              }}
            />
          ))}
        </div>
      </Fold>
      <Fold title="Beschikbaarheid">
        <AvailabilityForm
          player={player}
          onSave={(slots) => {
            Promise.resolve(onAvailability(slots))
              .then(() => toast.success("Tijden bewaard."))
              .catch((reason: unknown) => toast.error(errorText(reason)));
          }}
        />
      </Fold>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1 font-display text-2xl italic [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </details>
  );
}

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function readBackupFile(file: File) {
  return file.text().then(
    (text) =>
      JSON.parse(text) as {
        kind?: string;
        players?: Player[];
        challenges?: Challenge[];
        matches?: Match[];
        personaId?: string;
        ladder?: { id?: string };
      },
  );
}

function DemoBackup() {
  const fileRef = { current: null as HTMLInputElement | null };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ivory-dim">De demo staat op dit apparaat. Een bestand kun je bewaren en later terugzetten.</p>
      <button
        type="button"
        className="btn btn-ivory self-start"
        onClick={() => {
          const state = useDemoStore.getState();
          downloadJson(`piramide-demo-${new Date().toISOString().slice(0, 10)}.json`, {
            kind: "piramide-backup",
            version: 1,
            source: "demo",
            exportedAt: new Date().toISOString(),
            personaId: state.personaId,
            players: state.players,
            challenges: state.challenges,
            matches: state.matches,
          });
          toast.success("Backup gedownload.");
        }}
      >
        Backup maken
      </button>
      <input
        ref={(node) => {
          fileRef.current = node;
        }}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void readBackupFile(file)
            .then((backup) => {
              if (backup.kind !== "piramide-backup" || !Array.isArray(backup.players)) {
                throw new Error("Dit is geen piramide-backup.");
              }
              if (!window.confirm("De demo wordt vervangen door deze backup. Doorgaan?")) return;
              useDemoStore.getState().loadBackup({
                players: backup.players,
                challenges: Array.isArray(backup.challenges) ? backup.challenges : [],
                matches: Array.isArray(backup.matches) ? backup.matches : [],
                personaId: backup.personaId ?? backup.players[0]?.id ?? "",
              });
              toast.success("Backup teruggezet.");
            })
            .catch((reason: unknown) => toast.error(errorText(reason)));
        }}
      />
      <button type="button" className="btn btn-ghost self-start" onClick={() => fileRef.current?.click()}>
        Backup terugzetten
      </button>
    </div>
  );
}

function LiveBackup({ ladderId, amOwner }: { ladderId: string; amOwner: boolean }) {
  const fileRef = { current: null as HTMLInputElement | null };
  const [busy, setBusy] = useState(false);
  if (!amOwner) {
    return <p className="text-sm text-ivory-dim">Alleen de beheerder maakt een backup of zet die terug.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ivory-dim">Bewaar de piramide als bestand. Terugzetten vervangt de deelnemers, uitslagen en uitdagingen.</p>
      <button
        type="button"
        className="btn btn-ivory self-start"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void exportLadderBackup({ data: ladderId })
            .then((backup) => {
              downloadJson(`piramide-${ladderId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`, backup);
              toast.success("Backup gedownload.");
            })
            .catch((reason: unknown) => toast.error(errorText(reason)))
            .finally(() => setBusy(false));
        }}
      >
        Backup maken
      </button>
      <input
        ref={(node) => {
          fileRef.current = node;
        }}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void readBackupFile(file)
            .then((backup) => {
              if (!window.confirm("Deze piramide wordt vervangen door de backup. Doorgaan?")) return;
              return restoreLadderBackup({ data: { ladderId, backup } }).then(() => {
                window.dispatchEvent(new Event("piramide-refresh"));
                toast.success("Backup teruggezet.");
              });
            })
            .catch((reason: unknown) => toast.error(errorText(reason)));
        }}
      />
      <button type="button" className="btn btn-ghost self-start" onClick={() => fileRef.current?.click()}>
        Backup terugzetten
      </button>
    </div>
  );
}

function DatabasePanel({ demo = false }: { demo?: boolean }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof databaseStatus>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    databaseStatus()
      .then((result) => {
        if (active) setInfo(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  if (error) return <p className="text-sm text-brass">{error}</p>;
  if (!info) return <div className="panel h-16 animate-pulse" />;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {demo ? <p className="text-ivory-dim">De demo zelf staat alleen op dit apparaat.</p> : null}
      {info.source === "neon" ? (
        <>
          <p>De piramide staat in Neon.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ivory-dim">
            <dt>Host</dt>
            <dd className="truncate">{info.host ?? "onbekend"}</dd>
            <dt>Database</dt>
            <dd className="truncate">{info.database ?? "onbekend"}</dd>
            <dt>Gebruiker</dt>
            <dd className="truncate">{info.user ?? "onbekend"}</dd>
            <dt>SSL</dt>
            <dd>{info.ssl ?? "require"}</dd>
          </dl>
        </>
      ) : (
        <p className="text-ivory-dim">Er is geen Neon-database gekoppeld. De gegevens staan lokaal in de preview (PGLite).</p>
      )}
    </div>
  );
}
