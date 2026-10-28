import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addLadderPlayer,
  createChallenge,
  getLadder,
  nudgeLadderPlayer,
  recordResult,
  recordGroupResult,
  editResult,
  removeLadderPlayer,
  restoreLadderPlayer,
  respondChallenge,
  setAvailability,
} from "@/lib/pyramid/api";
import type { LadderSnapshot } from "@/lib/pyramid/types";
import { LadderScreen } from "@/components/pyramid/ladder-screen";
import { Shell } from "@/components/pyramid/shell";

export const Route = createFileRoute("/ladder/$id")({ component: LiveLadder });

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Er ging iets mis.";
}

function LiveLadder() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<LadderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const snapshot = await getLadder({ data: id });
    setData(snapshot);
    setError(null);
  }, [id]);

  useEffect(() => {
    if (isPending || !user) return;
    let active = true;
    const refresh = () => {
      getLadder({ data: id })
        .then((snapshot) => {
          if (active) setData(snapshot);
        })
        .catch((reason: unknown) => {
          if (active) setError(errorText(reason));
        });
    };
    refresh();
    window.addEventListener("piramide-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("piramide-refresh", refresh);
    };
  }, [id, isPending, user]);

  if (isPending || (user && !data && !error)) {
    return (
      <Shell>
        <div className="panel h-48 animate-pulse" />
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (error || !data) {
    return (
      <Shell>
        <h1 className="font-display text-4xl italic">Deze piramide is dicht</h1>
        <p className="mt-2 text-ivory-dim">{error ?? "Niet gevonden."}</p>
        <Link to="/" className="btn btn-brass mt-6">
          Terug
        </Link>
      </Shell>
    );
  }

  return (
    <LadderScreen
      mode="live"
      name={data.name}
      challengeRange={data.challengeRange}
      inviteCode={data.inviteCode}
      amOwner={data.amOwner}
      meId={data.meId}
      players={data.players}
      challenges={data.challenges}
      matches={data.matches}
      onChallenge={async (input) => {
        const result = await createChallenge({ data: { ladderId: id, ...input } });
        await load();
        return result;
      }}
      onRespond={async (challengeId, action) => {
        await respondChallenge({ data: { ladderId: id, challengeId, action } });
        await load();
      }}
      onResult={async (input) => {
        const outcome = await recordResult({ data: { ladderId: id, ...input } });
        await load();
        return outcome;
      }}
      onGroupResult={async (input) => {
        const outcome = await recordGroupResult({ data: { ladderId: id, ...input } });
        await load();
        return outcome;
      }}
      onEditResult={async (input) => {
        const outcome = await editResult({ data: { ladderId: id, ...input } });
        await load();
        return outcome;
      }}
      onAvailability={async (slots) => {
        await setAvailability({ data: { ladderId: id, slots } });
        await load();
      }}
      onNudge={
        data.amOwner
          ? async (playerId, direction) => {
              await nudgeLadderPlayer({ data: { ladderId: id, playerId, direction } });
              await load();
            }
          : undefined
      }
      onRemove={
        data.amOwner
          ? async (playerId) => {
              await removeLadderPlayer({ data: { ladderId: id, playerId } });
              await load();
            }
          : undefined
      }
      onRestore={
        data.amOwner
          ? async (playerId) => {
              await restoreLadderPlayer({ data: { ladderId: id, playerId } });
              await load();
            }
          : undefined
      }
      onAdd={
        data.amOwner
          ? async (name) => {
              await addLadderPlayer({ data: { ladderId: id, name } });
              await load();
            }
          : undefined
      }
    />
  );
}
