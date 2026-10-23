import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DAYS_SHORT, fmtMin, TIME_OPTIONS } from "@/lib/pyramid/format";
import { normalizeSlots } from "@/lib/pyramid/rules";
import type { Player, Slot } from "@/lib/pyramid/types";
import { cn } from "@/lib/cn";

export function AvailabilityForm({ player, onSave }: { player: Player; onSave: (slots: Slot[]) => void }) {
  const [slots, setSlots] = useState<Slot[]>(player.availability);

  function daySlots(day: number) {
    return slots
      .map((slot, index) => ({ slot, index }))
      .filter((item) => item.slot.day === day)
      .sort((a, b) => a.slot.startMin - b.slot.startMin);
  }

  function toggle(day: number) {
    setSlots((current) =>
      current.some((slot) => slot.day === day)
        ? current.filter((slot) => slot.day !== day)
        : [...current, { day, startMin: 12 * 60, endMin: 13 * 60 }],
    );
  }

  function add(day: number) {
    setSlots((current) => {
      const mine = current.filter((slot) => slot.day === day).sort((a, b) => a.startMin - b.startMin);
      if (mine.length >= 4) return current;
      const last = mine[mine.length - 1];
      let startMin = last ? last.endMin : 12 * 60;
      let endMin = startMin + 60;
      if (endMin > 24 * 60) {
        startMin = 18 * 60;
        endMin = 19 * 60;
      }
      return [...current, { day, startMin, endMin }];
    });
  }

  function update(index: number, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)));
  }

  function remove(index: number) {
    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(normalizeSlots(slots));
      }}
    >
      <p className="text-sm text-ivory-dim">Zet een dag aan. Je kunt meerdere tijden op dezelfde dag zetten.</p>
      <ul className="flex flex-col gap-3">
        {DAYS_SHORT.map((label, day) => {
          const mine = daySlots(day);
          return (
            <li key={label} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={mine.length > 0}
                  onClick={() => toggle(day)}
                  className={cn("btn h-10 min-h-0 w-14 px-0 text-sm uppercase", mine.length ? "btn-brass" : "btn-ghost")}
                >
                  {label}
                </button>
                {mine.length === 0 ? <span className="text-sm text-ivory-dim">niet vrij</span> : null}
              </div>
              {mine.map(({ slot, index }) => (
                <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2 pl-16">
                  <TimeSelect value={slot.startMin} onChange={(startMin) => update(index, { startMin })} />
                  <span className="text-ivory-dim">tot</span>
                  <TimeSelect value={slot.endMin} onChange={(endMin) => update(index, { endMin })} />
                  <button
                    type="button"
                    className="btn btn-quiet size-11 px-0"
                    aria-label={`${label} tijd weghalen`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {mine.length > 0 && mine.length < 4 ? (
                <button type="button" className="btn btn-ghost ml-16 self-start" onClick={() => add(day)}>
                  <Plus className="size-4" /> Nog een tijd
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="submit" className="btn btn-brass self-start">
        Tijden bewaren
      </button>
    </form>
  );
}

function TimeSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <select className="field w-auto" value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {TIME_OPTIONS.map((minutes) => (
        <option key={minutes} value={minutes}>
          {fmtMin(minutes)}
        </option>
      ))}
    </select>
  );
}
