import type { PyramidStats, StatRow } from "@/lib/pyramid/stats";

function Bars({ rows, empty }: { rows: StatRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ivory-dim">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums text-ivory-dim">{row.text}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-sm bg-felt-deep">
            <div
              className="h-full rounded-sm bg-brass"
              style={{ width: row.value === 0 ? "0%" : `${Math.max(8, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatsPanel({ stats }: { stats: PyramidStats }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ivory-dim">
        {stats.played === 0 ? "Nog geen partijen." : `${stats.played} ${stats.played === 1 ? "partij" : "partijen"} meegeteld.`}
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Partijen per maand</h2>
        <Bars rows={stats.months.filter((row) => row.value > 0).length ? stats.months : []} empty="Nog geen partijen." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Meeste overwinningen</h2>
        <Bars rows={stats.wins} empty="Nog niemand heeft gewonnen." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Beste winstpercentage</h2>
        <p className="text-sm text-ivory-dim">{stats.rateNote}</p>
        <Bars rows={stats.rates} empty="Nog geen uitslagen." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Stippen op de troon</h2>
        <Bars rows={stats.stippen} empty="Nog geen geslaagde verdediging van plek 1." />
      </section>
    </div>
  );
}
