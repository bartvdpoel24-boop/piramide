import type { ReactNode } from "react";
import { FeedbackButton } from "./feedback";

export function Shell({ children, place }: { children: ReactNode; place?: string }) {
  return (
    <div className="felt-nap min-h-dvh text-ivory">
      <div className="rail" />
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-10">
        <div className="mb-4 flex justify-end">
          <FeedbackButton place={place} />
        </div>
        {children}
      </div>
    </div>
  );
}
