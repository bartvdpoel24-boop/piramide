import { DAYS_LONG, fmtMin, todayDayIndex } from "@/lib/pyramid/format";
import type { Player } from "@/lib/pyramid/types";

export function TimesBoard({ players }: { players: Player[] }) {
  const today = todayDayIndex();
  const freeToday = players.filter((player) => player.availability.some((slot) => slot.day === today));
  return (
    <div className="flex flex-col gap-4">
      {freeToday.length > 0 ? (
        <p className="text-sm text-ivory-dim">Vandaag vrij: {freeToday.map((player) => player.name).join(", ")}</p>
      ) : (
        <p className="text-sm text-ivory-dim">Vandaag heeft nog niemand een tijd doorgegeven.</p>
      )}
      <ul className="flex flex-col gap-3">
        {DAYS_LONG.map((day, index) => {
          const names = players.filter((player) => player.availability.some((slot) => slot.day === index));
          return (
            <li key={day} className="flex flex-col gap-1 border-b border-line pb-2 last:border-0">
              <span className="text-sm tracking-wide text-brass uppercase">{day}</span>
              <span className="text-sm text-ivory-dim">
                {names.length
                  ? names
                      .map((player) => {
                        const times = player.availability
                          .filter((item) => item.day === index)
                          .map((item) => `${fmtMin(item.startMin)}–${fmtMin(item.endMin)}`)
                          .join(", ");
                        return times ? `${player.name} ${times}` : player.name;
                      })
                      .join(" · ")
                  : "niemand doorgegeven"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
