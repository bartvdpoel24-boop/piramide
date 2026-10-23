import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isPyramidAdmin } from "./rules";

const REPO = "bartvdpoel24-boop/piramide";
const TOKEN_FILE = "/tmp/grok/connectors/github.token";
const TOKEN_KEY = "github_token";

const KINDS = {
  bug: "Bug",
  idee: "Idee",
  vraag: "Vraag",
} as const;

type Kind = keyof typeof KINDS;
type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

function cleanLine(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function scrub(value: string) {
  return value
    .replace(/gho_[A-Za-z0-9_]+/g, "")
    .replace(/ghu_[A-Za-z0-9_]+/g, "")
    .replace(/ghp_[A-Za-z0-9_]+/g, "")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "")
    .trim()
    .slice(0, 180);
}

export function usableToken(value: string) {
  const token = value.trim();
  if (!/^(gho_|ghu_|ghp_|github_pat_)[A-Za-z0-9_]+$/.test(token)) return "";
  if (token.length < 20 || token.length > 255) return "";
  return token;
}

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function tokenFromGh(bin: string) {
  const { execFile } = await import("node:child_process");
  return new Promise<string>((resolve, reject) => {
    execFile(
      bin,
      ["auth", "token"],
      {
        timeout: 8000,
        env: {
          ...process.env,
          GH_PROMPT_DISABLED: "1",
          PATH: `/usr/local/bin:${process.env.PATH ?? "/usr/bin:/bin"}`,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(scrub(String(stderr || error.message)) || "Geen GitHub-token."));
          return;
        }
        const token = usableToken(String(stdout));
        if (!token) reject(new Error("Geen GitHub-token."));
        else resolve(token);
      },
    );
  });
}

async function tokenFromDb(sql: Sql) {
  const rows = await sql<{ value: string }>`select value from app_settings where key = ${TOKEN_KEY}`;
  return usableToken(rows[0]?.value ?? "");
}

async function saveToken(sql: Sql, token: string) {
  await sql`
    insert into app_settings (key, value) values (${TOKEN_KEY}, ${token})
    on conflict (key) do update set value = ${token}
  `;
}

/** Env, the saved setting, the linked GitHub account, then the gh command. */
export async function readGhToken(sql?: Sql) {
  const fromEnv = usableToken(process.env.GITHUB_TOKEN ?? "") || usableToken(process.env.GH_TOKEN ?? "");
  if (fromEnv) return fromEnv;
  if (sql) {
    const stored = await tokenFromDb(sql);
    if (stored) return stored;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const fromFile = usableToken(await readFile(TOKEN_FILE, "utf8"));
    if (fromFile) {
      if (sql) await saveToken(sql, fromFile).catch(() => undefined);
      return fromFile;
    }
  } catch {
    /* alleen aanwezig zolang GitHub hier gekoppeld is */
  }
  let last = "Geen GitHub-token.";
  for (const bin of ["/usr/local/bin/gh", "gh"]) {
    try {
      const token = await tokenFromGh(bin);
      if (sql) await saveToken(sql, token).catch(() => undefined);
      return token;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

async function canConfigure(sql: Sql, userId: string) {
  const named = await sql<{ id: string; display_name: string }>`
    select id, display_name from ladder_players where user_id = ${userId}
  `;
  if (named.some((player) => isPyramidAdmin({ id: player.id, name: player.display_name }))) return true;
  const owned = await sql<{ id: string }>`select id from ladders where owner_id = ${userId} limit 1`;
  return Boolean(owned[0]);
}

const NOT_READY =
  "Meldingen staan nog uit. Zet bij Instellingen een GitHub-token met schrijfrecht op issues van bartvdpoel24-boop/piramide.";

async function createOnGitHub(token: string, title: string, body: string) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "piramide-feedback",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ title, body }),
  });
  if (!response.ok) throw new Error("De melding kon niet op GitHub gezet worden.");
  const created = (await response.json()) as { number?: number; html_url?: string };
  const url = String(created.html_url ?? "");
  const number = Number(created.number);
  if (!url.startsWith(`https://github.com/${REPO}/issues/`) || !Number.isInteger(number)) {
    throw new Error("GitHub gaf geen meldingsnummer terug.");
  }
  return { number, url };
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
    if (url.startsWith(`https://github.com/${REPO}/issues/`) && Number.isInteger(number)) return { number, url };
    for (const value of Object.values(record)) piles.push(value);
  }
  return null;
}

async function createViaConnector(title: string, body: string) {
  try {
    const { callTool } = await import("@/lib/app-data/client.server");
    const result = await callTool(
      "github___issue_write",
      { method: "create", owner: "bartvdpoel24-boop", repo: "piramide", title, body },
      { connectorType: "GitHub" as "GoogleDrive" },
    );
    if (!result.ok) return null;
    return issueFromTool(result.data);
  } catch {
    return null;
  }
}

export const feedbackStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    let ready = false;
    try {
      await readGhToken(sql);
      ready = true;
    } catch {
      ready = false;
    }
    return { ready, canConfigure: await canConfigure(sql, context.userId) };
  });

export const saveFeedbackToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { token?: string }) => {
    const token = usableToken(String(input?.token ?? ""));
    if (!token) throw new Error("Dat lijkt geen GitHub-token.");
    return { token };
  })
  .handler(async ({ context, data }) => {
    const sql = await db();
    if (!(await canConfigure(sql, context.userId))) throw new Error("Alleen Bart kan meldingen aanzetten.");
    const probe = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${data.token}`,
        "User-Agent": "piramide-feedback",
      },
    });
    if (!probe.ok) throw new Error("GitHub accepteert dit token niet voor de piramide-repo.");
    await saveToken(sql, data.token);
    return { ready: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      kind?: string;
      title?: string;
      message?: string;
      who?: string;
      place?: string;
      screen?: string;
    }) => {
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
    },
  )
  .handler(async ({ context, data }) => {
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
      `Account: ${context.userId}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const sql = await db();
    let token = "";
    try {
      token = await readGhToken(sql);
    } catch {
      token = "";
    }
    if (token) return await createOnGitHub(token, title, body);
    const viaGate = await createViaConnector(title, body);
    if (viaGate) return viaGate;
    throw new Error(NOT_READY);
  });
