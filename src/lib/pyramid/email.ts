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
  free?: boolean;
}) {
  const lines = [
    input.free
      ? `${input.challenger} nodigt je uit om vrij te spelen in ${input.ladder}. De piramide blijft staan.`
      : `${input.challenger} daagt je uit in ${input.ladder}.`,
    "",
    input.when ? `Voorgesteld: ${input.when}` : "Er is nog geen tijdstip gekozen.",
    input.message ? `Bericht: ${input.message}` : null,
    "",
    "Open Piramide om te antwoorden.",
  ].filter((line): line is string => line !== null);
  return {
    to: input.to,
    subject: input.free ? `${input.challenger} nodigt je uit in Piramide` : `${input.challenger} daagt je uit in Piramide`,
    body: lines.join("\n"),
  };
}
