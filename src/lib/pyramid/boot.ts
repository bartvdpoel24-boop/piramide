import { useSyncExternalStore } from "react";

type Boot = { ready: boolean; progress: number };

let boot: Boot = { ready: false, progress: 8 };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setBoot(patch: Partial<Boot>) {
  const next = { ...boot, ...patch };
  if (boot.ready) next.ready = true;
  if (next.progress < boot.progress) next.progress = boot.progress;
  if (next.ready === boot.ready && next.progress === boot.progress) return;
  boot = next;
  emit();
}

export function useBoot() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => boot,
  );
}
