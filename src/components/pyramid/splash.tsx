import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setBoot, useBoot } from "@/lib/pyramid/boot";
import { RELEASES } from "@/lib/pyramid/version";
import { RackMark } from "./mark";

const latest = RELEASES[0];

export function BootSplash() {
  const { isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const boot = useBoot();

  useEffect(() => {
    if (boot.ready) return;
    if (isPending) {
      setBoot({ progress: 32 });
      return;
    }
    if (pathname === "/" || pathname.startsWith("/ladder/")) {
      setBoot({ progress: pathname === "/" ? 64 : 72 });
      return;
    }
    setBoot({ progress: 100, ready: true });
  }, [boot.ready, isPending, pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBoot({ progress: 100, ready: true }), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return <Splash />;
}

function Splash() {
  const { ready, progress } = useBoot();
  const [shown, setShown] = useState(8);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShown((value) => {
        const target = ready ? 100 : progress;
        if (value >= target) return value;
        return Math.min(target, value + Math.max(1, (target - value) * 0.18));
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [progress, ready]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setGone(true), 380);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (gone) return null;

  const percent = Math.round(shown);

  return (
    <div
      className="felt-nap fixed inset-0 z-[80] flex flex-col text-ivory transition-opacity duration-300"
      style={{ opacity: ready ? 0 : 1 }}
      role="dialog"
      aria-label="Piramide laden"
      aria-busy={!ready}
    >
      <div className="rail" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <RackMark className="splash-mark h-28 w-32" />
        <p className="splash-copy mt-6 text-xs font-semibold tracking-widest text-brass uppercase">Pool ladder</p>
        <h1 className="splash-copy font-display mt-2 text-6xl italic text-ivory">Piramide</h1>
        <div
          className="mt-8 h-1.5 w-52 overflow-hidden rounded-full bg-baize"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Laadvoortgang"
        >
          <div className="h-full rounded-full bg-brass" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs tabular-nums text-ivory-dim">{percent}%</p>
        {latest ? (
          <p className="splash-copy mt-8 max-w-xs text-sm text-ivory-dim">
            <span className="text-ivory">Laatste wijziging · versie {latest.version}</span>
            <span className="mt-1 block text-xs">{latest.date}</span>
            <span className="mt-1 block">{latest.notes[0]}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
