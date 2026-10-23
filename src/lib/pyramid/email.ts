export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email) return "";
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Dat lijkt geen e-mailadres.");
  }
  return email;
}

export function challengeMail(input: {
  to: string;
  challenger: string;
  ladder: string;
  when: string;
  message: string;
}) {
  const lines = [
    `${input.challenger} daagt je uit in ${input.ladder}.`,
    "",
    input.when ? `Voorgesteld: ${input.when}` : "Er is nog geen tijdstip gekozen.",
    input.message ? `Bericht: ${input.message}` : null,
    "",
    "Open Piramide om de uitdaging te accepteren of af te wijzen.",
  ].filter((line): line is string => line !== null);
  return {
    to: input.to,
    subject: `${input.challenger} daagt je uit in Piramide`,
    body: lines.join("\n"),
  };
}
