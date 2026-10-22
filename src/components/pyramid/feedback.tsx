import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageSquarePlus } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { submitFeedback } from "@/lib/pyramid/feedback";
import { cn } from "@/lib/cn";

const KINDS = [
  { id: "bug", label: "Bug" },
  { id: "idee", label: "Idee" },
  { id: "vraag", label: "Vraag" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

function errorText(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return "Log in met Google. Dan komt de melding direct op GitHub.";
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "De melding kon niet geplaatst worden.";
}

export function FeedbackButton({ place }: { place?: string }) {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ number: number; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signedIn = user && !user.isDevFallback ? user : null;
  const [who, setWho] = useState("");

  useEffect(() => {
    if (!signedIn?.displayName) return;
    setWho((current) => current || signedIn.displayName || "");
  }, [signedIn?.displayName]);

  function close() {
    setOpen(false);
    setKind("bug");
    setTitle("");
    setMessage("");
    setCreated(null);
    setError(null);
    setPending(false);
    setWho(signedIn?.displayName ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const name = who.trim();
    const from = [name, signedIn?.primaryEmail].filter(Boolean).join(" · ");
    try {
      const result = await submitFeedback({
        data: {
          kind,
          title,
          message,
          who: from,
          place,
          screen: window.location.pathname,
        },
      });
      setCreated(result);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" aria-hidden />
        Geef feedback
      </button>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
          <Dialog.Content className="sheet">
            <Dialog.Title className="font-display text-3xl italic">Geef feedback</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink/70">
              Bug, idee of vraag. Dit wordt meteen een melding in de GitHub-repo van Piramide.
            </Dialog.Description>
            {created ? (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-sm text-ink/80">
                  Melding <span className="font-semibold">#{created.number}</span> staat op GitHub.
                </p>
                <a href={created.url} target="_blank" rel="noreferrer" className="btn btn-ink">
                  Bekijk de melding
                </a>
                <button type="button" className="btn btn-quiet" onClick={close}>
                  Klaar
                </button>
              </div>
            ) : (
              <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
                <div className="flex gap-2" role="radiogroup" aria-label="Soort melding">
                  {KINDS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={kind === item.id}
                      className={cn("btn flex-1", kind === item.id ? "btn-ink" : "btn-quiet")}
                      onClick={() => setKind(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  Onderwerp
                  <input
                    className="field-ink"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Kort, zodat je het later terugvindt"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Wat speelt er
                  <textarea
                    className="field-ink min-h-32 resize-y"
                    value={message}
                    maxLength={2000}
                    required
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Wat deed je, wat verwachtte je, wat gebeurde er?"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Je naam
                  <input
                    className="field-ink"
                    value={who}
                    maxLength={80}
                    onChange={(event) => setWho(event.target.value)}
                    placeholder="Optioneel"
                  />
                </label>
                {error ? <p className="text-sm text-ink">{error}</p> : null}
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-ink flex-1" disabled={pending}>
                    {pending ? "Bezig…" : "Melding plaatsen"}
                  </button>
                  <Dialog.Close type="button" className="btn btn-quiet">
                    Terug
                  </Dialog.Close>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
