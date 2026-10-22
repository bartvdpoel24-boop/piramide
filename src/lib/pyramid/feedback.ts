import { execFile } from "node:child_process";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

const REPO = "bartvdpoel24-boop/piramide";

const KINDS = {
  bug: "Bug",
  idee: "Idee",
  vraag: "Vraag",
} as const;

type Kind = keyof typeof KINDS;

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

function readGhToken() {
  const fromEnv = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return new Promise<string>((resolve, reject) => {
    execFile(
      "gh",
      ["auth", "token"],
      { timeout: 8000, env: { ...process.env, GH_PROMPT_DISABLED: "1" } },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(scrub(String(stderr || error.message)) || "Geen GitHub-token."));
          return;
        }
        const token = String(stdout).trim();
        if (!token) reject(new Error("Geen GitHub-token."));
        else resolve(token);
      },
    );
  });
}

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
      const message = String(input?.message ?? "").trim().slice(0, 2000);
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

    let token: string;
    try {
      token = await readGhToken();
    } catch {
      throw new Error("Feedback staat nog niet aan op deze server.");
    }

    const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "piramide-feedback",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title: `[${label}] ${data.title}`, body }),
    });

    if (!response.ok) {
      throw new Error("De melding kon niet op GitHub gezet worden.");
    }
    const created = (await response.json()) as { number?: number; html_url?: string };
    const url = String(created.html_url ?? "");
    const number = Number(created.number);
    if (!url.startsWith(`https://github.com/${REPO}/issues/`) || !Number.isInteger(number)) {
      throw new Error("GitHub gaf geen meldingsnummer terug.");
    }
    return { number, url };
  });
