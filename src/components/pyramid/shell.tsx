import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="felt-nap min-h-dvh text-ivory">
      <div className="rail" />
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-16">{children}</div>
    </div>
  );
}
