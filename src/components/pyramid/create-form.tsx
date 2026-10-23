import { useState } from "react";
import { createLadder } from "@/lib/pyramid/api";
import { WALL } from "@/lib/pyramid/roster";

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Er ging iets mis.";
}

export function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("Kantoorpiramide");
  const [importWall, setImportWall] = useState(true);
  const [claim, setClaim] = useState("Bart van der Poel");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const claimName = importWall ? (claim === "__new" ? custom : claim) : custom || claim;
        setBusy(true);
        setError(null);
        createLadder({ data: { name, importWall, claimName } })
          .then((result) => onCreated(result.id))
          .catch((reason: unknown) => {
            setError(errorText(reason));
            setBusy(false);
          });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Naam van de piramide
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={importWall} onChange={(event) => setImportWall(event.target.checked)} />
        Begin met de namen van de muur
      </label>
      {importWall ? (
        <label className="flex flex-col gap-1 text-sm">
          Welk briefje ben jij?
          <select className="field" value={claim} onChange={(event) => setClaim(event.target.value)}>
            {WALL.map((person) => (
              <option key={person.id} value={person.name}>
                {person.name}
              </option>
            ))}
            <option value="__new">Ik sta er nog niet bij</option>
          </select>
        </label>
      ) : null}
      {!importWall || claim === "__new" ? (
        <label className="flex flex-col gap-1 text-sm">
          Jouw naam
          <input className="field" value={custom} onChange={(event) => setCustom(event.target.value)} required />
        </label>
      ) : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      <button type="submit" className="btn btn-brass self-start" disabled={busy}>
        {busy ? "Bezig…" : "Piramide openen"}
      </button>
    </form>
  );
}
