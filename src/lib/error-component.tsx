import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "Er ging iets mis. Vernieuw het scherm.";
const RELOAD_KEY = "piramide-chunk-reload";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function isStaleChunkError(error: unknown) {
  const message = errorMessage(error);
  return /dynamically imported module|module script failed|Importing a module script failed/i.test(message);
}

export function reloadForStaleChunk() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const stale = isStaleChunkError(error);
  useEffect(() => {
    if (stale) reloadForStaleChunk();
  }, [stale]);

  return (
    <main className="felt-nap flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-ivory">
      <span className="text-brass" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-3xl italic">{stale ? "Pagina is bijgewerkt" : "Er ging iets mis"}</h1>
      <p className="max-w-md text-sm break-words text-ivory-dim">
        {stale ? "De app laadt de nieuwe versie. Lukt dat niet, vernieuw dan het scherm." : errorMessage(error)}
      </p>
    </main>
  );
}

export function ChunkReload() {
  useEffect(() => {
    const onPreload = (event: Event) => {
      event.preventDefault();
      reloadForStaleChunk();
    };
    window.addEventListener("vite:preloadError", onPreload);
    return () => window.removeEventListener("vite:preloadError", onPreload);
  }, []);
  return null;
}
