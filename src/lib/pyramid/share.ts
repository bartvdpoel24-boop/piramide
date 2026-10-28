export function normalizeInviteCode(value: string) {
  const clean = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(clean)) throw new Error("Die code klopt niet.");
  return clean;
}

export function joinPath(code: string, playerId = "") {
  const path = `/join/${normalizeInviteCode(code)}`;
  const seat = playerId.trim();
  if (!seat) return path;
  return `${path}?blad=${encodeURIComponent(seat)}`;
}

export function joinUrl(code: string, playerId = "") {
  const path = joinPath(code, playerId);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function joinMessage(name: string, url: string) {
  return `Doe mee met ${name} in Piramide. Open de link en koppel je naam:\n${url}`;
}

export function seatMessage(ladder: string, player: string, url: string) {
  return `Koppel je aan het briefje van ${player} in ${ladder}:\n${url}`;
}

export function whatsAppHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
