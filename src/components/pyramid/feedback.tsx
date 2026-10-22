import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageSquarePlus } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";

const REPO = "bartvdpoel24-boop/piramide";

const KINDS = [
  { id: "bug", label: "Bug" },
  { id: "idee", label: "Idee" },
  { id: "vraag", label: "Vraag" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

function issueUrl(input: { kind: Kind; title: string; message: string; who: string; place?: string }) {
  const kind = KINDS.find((item) => item.id === input.kind)?.label ?? "Feedback";
  const title = `[${kind}] ${input.title.trim()}`;
  const lines = [
    input.message.trim(),
    "",
    "---",
    `Soort: ${kind}`,
    input.who ? `Van: ${input.who}` : null,
    input.place ? `Plek: ${input.place}` : null,
    `Scherm: ${window.location.pathname}`,
  ].filter((line): line is string => line !== null);
  const params = new URLSearchParams({ title, body: lines.join("\n") });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

export function FeedbackButton({ place }: { place?: string }) {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [href, setHref] = useState<string | null>(null);
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
    setHref(null);
    setWho(signedIn?.displayName ?? "");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = who.trim();
    const from = [name, signedIn?.primaryEmail].filter(Boolean).join(" · ");
    const url = issueUrl({ kind, title, message, who: from, place });
    const popup = window.open(url, "_blank");
    if (popup) popup.opener = null;
    setHref(url);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        Geef feedback
      </button>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-felt-deep/80" />
          <Dialog.Content className="sheet">
            <Dialog.Title className="font-display text-3xl italic">Geef feedback</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink/70">
              Bug, idee of vraag. Dit wordt een melding in de GitHub-repo van Piramide. Je bevestigt hem daar nog
              één keer.
            </Dialog.Description>
            {href ? (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-sm text-ink/80">
                  GitHub is geopend met je tekst erin. Kies daar <span className="font-semibold">Submit new issue</span>
                  . Lukt het venster niet, gebruik dan de knop hieronder.
                </p>
                <a href={href} target="_blank" rel="noreferrer" className="btn btn-ink">
                  Melding openen op GitHub
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
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-ink flex-1">
                    Melding plaatsen
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
