import { NOTE_COLORS, type NoteColor } from "./types";

export const NOTE_BG: Record<NoteColor, string> = {
  ice: "var(--color-note-ice)",
  sky: "var(--color-note-sky)",
  butter: "var(--color-note-butter)",
  blush: "var(--color-note-blush)",
  coral: "var(--color-note-coral)",
  cream: "var(--color-note-cream)",
  lilac: "var(--color-note-lilac)",
  mint: "var(--color-note-mint)",
};

export const NOTE_LABEL: Record<NoteColor, string> = {
  ice: "Ijs",
  sky: "Lucht",
  butter: "Boter",
  blush: "Blush",
  coral: "Koraal",
  cream: "Room",
  lilac: "Lila",
  mint: "Munt",
};

export function asNoteColor(value: string): NoteColor {
  return NOTE_COLORS.includes(value as NoteColor) ? (value as NoteColor) : "cream";
}
