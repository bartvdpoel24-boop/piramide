import type { PyramidStats, StatRow } from "@/lib/pyramid/stats";

const PIE = ["#e0a84a", "#7ec8e3", "#f3b0a2", "#cfe8d4", "#e4d4f2", "#f6e7a8", "#f4c6dc", "#8fd0ea", "#d7b48a", "#9db8a4"];

function sliceColor(index: number) {
  return PIE[index] ?? `hsl(${(index * 47) % 360} 42% 68%)`;
}

function shares(rows: StatRow[]) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const raw = rows.map((row) => (row.value / total) * 100);
  const pct = raw.map((value) => Math.floor(value));
  let left = 100 - pct.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (const item of order) {
    if (left <= 0) break;
    pct[item.index] += 1;
    left -= 1;
  }
  return { total, pct };
}

function piePath(start: number, end: number) {
  const r = 46;
  const x1 = 50 + r * Math.cos(start);
  const y1 = 50 + r * Math.sin(start);
  const x2 = 50 + r * Math.cos(end);
  const y2 = 50 + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M 50 50 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function WinPie({ rows, empty = "Nog niemand heeft gewonnen." }: { rows: StatRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-ivory-dim">{empty}</p>;
  const { total, pct } = shares(rows);
  let angle = -Math.PI / 2;
  const slices = rows.map((row, index) => {
    const sweep = (row.value / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { ...row, start, end: angle, color: sliceColor(index), pct: pct[index] ?? 0 };
  });
  const summary = slices.map((slice) => `${slice.label} ${slice.pct}%`).join(", ");

  return (
    <figure className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-52 w-52" role="img" aria-label={`Verdeling van de winsten: ${summary}`}>
        {slices.length === 1 ? (
          <circle cx="50" cy="50" r="46" fill={slices[0]?.color} />
        ) : (
          slices.map((slice) => <path key={slice.label} d={piePath(slice.start, slice.end)} fill={slice.color} />)
        )}
      </svg>
      <ul className="grid w-full gap-1.5">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-ivory-dim">
              {slice.value} · {slice.pct}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

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
        <h2 className="font-display text-2xl italic">Verdeling van de winsten</h2>
        <WinPie rows={stats.winShare} />
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
        <h2 className="font-display text-2xl italic">Langste reeksen</h2>
        <Bars rows={stats.streaks} empty="Nog geen reeks." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl italic">Stippen op de troon</h2>
        <Bars rows={stats.stippen} empty="Nog geen geslaagde verdediging van plek 1." />
      </section>
    </div>
  );
}
