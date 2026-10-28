import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { joinLadder, peekInvite } from "@/lib/pyramid/api";
import { normalizeInviteCode } from "@/lib/pyramid/share";
import { JoinForm, SignInButtons } from "@/components/pyramid/lobby";
import { RackMark } from "@/components/pyramid/mark";
import { Shell } from "@/components/pyramid/shell";

export const Route = createFileRoute("/join/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    blad: typeof search.blad === "string" ? search.blad.slice(0, 80) : "",
  }),
  component: JoinPage,
});

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Er ging iets mis.";
}

function JoinPage() {
  const { code: raw } = Route.useParams();
  const { blad } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [title, setTitle] = useState<string | null>(null);
  const [seatName, setSeatName] = useState<string | null>(null);
  const [seatMissing, setSeatMissing] = useState(false);
  const [missing, setMissing] = useState(false);
  let code = "";
  try {
    code = normalizeInviteCode(raw);
  } catch {
    code = "";
  }
  const go = useCallback(
    (id: string) => {
      void navigate({ to: "/ladder/$id", params: { id } });
    },
    [navigate],
  );
  const back = code ? `/join/${code}${blad ? `?blad=${encodeURIComponent(blad)}` : ""}` : "/";

  useEffect(() => {
    if (!code) return;
    let active = true;
    peekInvite({ data: { code, playerId: blad } })
      .then((result) => {
        if (!active) return;
        if (!result.found) {
          setMissing(true);
          return;
        }
        setTitle(result.name);
        if (blad && !result.seat) setSeatMissing(true);
        else setSeatName(result.seat?.name ?? null);
      })
      .catch(() => {
        if (active) setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [blad, code]);

  return (
    <Shell>
      <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
        <RackMark className="h-14 w-16" />
        {!code || missing ? (
          <>
            <h1 className="font-display text-4xl italic">Link klopt niet</h1>
            <p className="text-ivory-dim">Vraag een nieuwe link of de code aan degene die de piramide deelt.</p>
          </>
        ) : seatMissing ? (
          <>
            <h1 className="font-display text-4xl italic">{title ?? "Uitnodiging"}</h1>
            <p className="text-ivory-dim">Dit briefje hoort niet bij de link.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl italic">{title ?? "Uitnodiging"}</h1>
            <p className="text-ivory-dim">
              {blad
                ? user
                  ? `Je wordt gekoppeld aan het briefje${seatName ? ` van ${seatName}` : ""}.`
                  : `Log in met Google. Daarna word je gekoppeld aan het briefje${seatName ? ` van ${seatName}` : ""}.`
                : user
                  ? "Koppel je naam aan een briefje, of schrijf je onderaan in."
                  : "Log in met Google. Daarna kies je je briefje en doe je mee."}
            </p>
            {isPending ? <div className="panel h-24 animate-pulse" /> : null}
            {!isPending && !user ? <SignInButtons callback={back} /> : null}
            {!isPending && user && blad ? <ClaimSeat code={code} playerId={blad} onJoined={go} /> : null}
            {!isPending && user && !blad ? <JoinForm onJoined={go} initialCode={code} locked /> : null}
          </>
        )}
      </div>
    </Shell>
  );
}

function ClaimSeat({ code, playerId, onJoined }: { code: string; playerId: string; onJoined: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      <button
        type="button"
        className="btn btn-brass self-start"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          joinLadder({ data: { code, playerId, name: "" } })
            .then((result) => onJoined(result.id))
            .catch((reason: unknown) => {
              setError(errorText(reason));
              setBusy(false);
            });
        }}
      >
        {busy ? "Bezig…" : "Koppel dit briefje"}
      </button>
    </div>
  );
}
