import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LadderScreen } from "@/components/pyramid/ladder-screen";
import { Shell } from "@/components/pyramid/shell";
import { useDemoStore } from "@/lib/pyramid/demo-store";
import { sendChallengeNotice } from "@/lib/pyramid/api";
import { challengeWhen } from "@/lib/pyramid/format";
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
      onChallenge={async (input) => {
        state.challenge(input);
        if (input.kind !== "challenge") return { mailed: false };
        const players = useDemoStore.getState().players;
        const me = players.find((player) => player.id === useDemoStore.getState().personaId);
        const defender = players.find((player) => player.id === input.defenderId);
        if (!defender?.email || !me) return { mailed: false };
        try {
          return await sendChallengeNotice({
            data: {
              to: defender.email,
              challenger: me.name,
              ladder: "Kantoorpiramide",
              when: challengeWhen({
                proposedDay: input.day,
                proposedStartMin: input.startMin,
                playOn: input.playOn,
              }),
              message: input.message,
            },
          });
        } catch {
          return { mailed: false, notify: true };
        }
      }}
      onRespond={async (id, action) => state.respond(id, action)}
      onResult={async (input) => state.record(input)}
      onGroupResult={async (input) => state.recordGroup(input)}
      onEditResult={async (input) => state.revise(input.matchId, input.winnerScore, input.loserScore, input.note)}
      onAvailability={async (slots) => state.setAvailability(slots)}
      onNudge={async (playerId, direction) => state.nudge(playerId, direction)}
      onRemove={async (playerId) => state.remove(playerId)}
      onRestore={async (playerId) => state.restore(playerId)}
      onAdd={async (name) => state.add(name)}
    />
  );
}
