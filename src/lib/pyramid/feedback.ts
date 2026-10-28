import { createServerFn } from "@tanstack/react-start";
import type { ConnectorTypeName } from "@/lib/app-data/types";
import { authMiddleware } from "@/lib/auth/middleware";

const REPO = "bartvdpoel24-boop/piramide";

const KINDS = {
  bug: "Bug",
  idee: "Idee",
  vraag: "Vraag",
} as const;

type Kind = keyof typeof KINDS;

export type FeedbackDraft = {
  kind: Kind;
  title: string;
  message: string;
  who: string;
  place: string;
  screen: string;
};

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function feedbackIssue(data: FeedbackDraft) {
  const label = KINDS[data.kind];
  const title = `[${label}] ${data.title}`;
  const body = [
    data.message,
    "",
    "---",
    `Soort: ${label}`,
    data.who ? `Van: ${data.who}` : null,
    data.place ? `Plek: ${data.place}` : null,
    data.screen ? `Scherm: ${data.screen}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const url = `https://github.com/${REPO}/issues/new?${new URLSearchParams({ title, body })}`;
  return { title, body, url };
}

function issueFromTool(data: unknown): { number: number; url: string } | null {
  const piles = [data];
  for (let i = 0; i < piles.length; i += 1) {
    const item = piles[i];
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      piles.push(...item);
      continue;
    }
    const record = item as Record<string, unknown>;
    const url = typeof record.html_url === "string" ? record.html_url : typeof record.url === "string" ? record.url : "";
    const number = Number(record.number);
    if (url.startsWith(`https://github.com/${REPO}/issues/`) && Number.isInteger(number) && number > 0) {
      return { number, url };
    }
    for (const value of Object.values(record)) piles.push(value);
  }
  const text = typeof data === "string" ? data : JSON.stringify(data ?? "");
  const match = text.match(/https:\/\/github\.com\/bartvdpoel24-boop\/piramide\/issues\/(\d+)/);
  if (!match) return null;
  return { number: Number(match[1]), url: match[0] };
}

async function createViaConnector(title: string, body: string) {
  const { callTool } = await import("@/lib/app-data/client.server");
  const result = await callTool(
    "github___issue_write",
    { method: "create", owner: "bartvdpoel24-boop", repo: "piramide", title, body },
    { connectorType: "GitHub" as ConnectorTypeName },
  );
  if (!result.ok) return null;
  return issueFromTool(result.data);
}

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<FeedbackDraft>) => {
    const kind = String(input?.kind ?? "") as Kind;
    if (!KINDS[kind]) throw new Error("Kies bug, idee of vraag.");
    const title = cleanLine(input?.title, 120);
    const message = String(input.message ?? "").trim().slice(0, 2000);
    if (title.length < 3) throw new Error("Het onderwerp is minstens 3 tekens.");
    if (message.length < 3) throw new Error("De tekst is minstens 3 tekens.");
    return {
      kind,
      title,
      message,
      who: cleanLine(input?.who, 80),
      place: cleanLine(input?.place, 80),
      screen: cleanLine(input?.screen, 120),
    };
  })
  .handler(async ({ context, data }) => {
    const issue = feedbackIssue(data);
    const body = `${issue.body}\nAccount: ${context.userId}`;
    const created = await createViaConnector(issue.title, body);
    if (created) return created;
    return { number: 0, url: issue.url };
  });
