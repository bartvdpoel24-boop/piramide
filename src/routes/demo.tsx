import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LadderScreen } from "@/components/pyramid/ladder-screen";
import { Shell } from "@/components/pyramid/shell";
import { useDemoStore } from "@/lib/pyramid/demo-store";
import { CHALLENGE_RANGE } from "@/lib/pyramid/types";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const [ready, setReady] = useState(false);
  const state = useDemoStore();

  useEffect(() => {
    const finish = () => setReady(true);
    const unsub = useDemoStore.persist.onFinishHydration(finish);
    if (useDemoStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  if (!ready) {
    return (
      <Shell>
        <p className="text-ivory-dim">De briefjes worden opgehangen…</p>
      </Shell>
    );
  }

  return (
    <LadderScreen
      mode="demo"
      name="Kantoorpiramide"
      challengeRange={CHALLENGE_RANGE}
      amOwner
      meId={state.personaId}
      players={state.players}
      challenges={state.challenges}
      matches={state.matches}
      onPersona={state.setPersona}
      onReset={state.reset}
      onChallenge={async (input) => state.challenge(input)}
      onRespond={async (id, action) => state.respond(id, action)}
      onResult={async (input) => state.record(input)}
      onAvailability={async (slots) => state.setAvailability(slots)}
      onNudge={async (playerId, direction) => state.nudge(playerId, direction)}
      onRemove={async (playerId) => state.remove(playerId)}
      onAdd={async (name) => state.add(name)}
      onRename={async (name) => state.rename(name)}
    />
  );
}
