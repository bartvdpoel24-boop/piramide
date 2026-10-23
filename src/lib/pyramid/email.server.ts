import { ConnectorType } from "@/lib/app-data/types";

export async function deliverChallengeMail(input: { to: string; subject: string; body: string }) {
  try {
    const { callTool } = await import("@/lib/app-data/client.server");
    const result = await callTool(
      "gmail_send_message",
      { to: [input.to], subject: input.subject, body: input.body },
      { connectorType: ConnectorType.Gmail },
    );
    return result.ok;
  } catch {
    return false;
  }
}
