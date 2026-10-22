import { useEffect, useState } from "react";
import { RackMark } from "./mark";

const SEEN = "piramide-splash";

export function Splash() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  function close() {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* private mode */
    }
    setOpen(false);
  }

  return (
    <div className="felt-nap fixed inset-0 z-40 flex flex-col text-ivory" role="dialog" aria-label="Piramide">
      <div className="rail" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <RackMark className="splash-mark h-28 w-32" />
        <p className="splash-copy mt-6 text-xs font-semibold tracking-widest text-brass uppercase">
          Pool ladder
        </p>
        <h1 className="splash-copy font-display mt-2 text-6xl italic text-ivory">Piramide</h1>
        <p className="splash-copy mt-3 max-w-xs text-ivory-dim">
          Wie maximaal vier plaatsen boven je staat, mag je uitdagen. Win je, dan wissel je van briefje.
        </p>
        <button type="button" className="btn btn-brass splash-copy mt-8 px-8" onClick={close}>
          De tafel op
        </button>
      </div>
    </div>
  );
}
