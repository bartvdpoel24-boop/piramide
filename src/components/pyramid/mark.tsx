import { cn } from "@/lib/cn";

const BALLS = [
  { cx: 50, cy: 16, fill: "var(--color-brass)", crown: true },
  { cx: 36, cy: 40, fill: "var(--color-ivory)" },
  { cx: 64, cy: 40, fill: "var(--color-chalk)" },
  { cx: 22, cy: 64, fill: "var(--color-ivory-dim)" },
  { cx: 50, cy: 64, fill: "var(--color-ivory)" },
  { cx: 78, cy: 64, fill: "var(--color-brass)" },
];

export function RackMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 82" className={cn("overflow-visible", className)} aria-hidden="true">
      {BALLS.map((ball) => (
        <g key={`${ball.cx}-${ball.cy}`}>
          <circle cx={ball.cx} cy={ball.cy} r="11" fill={ball.fill} />
          <circle cx={ball.cx - 3} cy={ball.cy - 3} r="3" fill="color-mix(in srgb, white 55%, transparent)" />
          {ball.crown ? (
            <path
              d="M44 12.5 L46.2 8.2 L50 11.2 L53.8 7.4 L56 12.5 Z"
              fill="var(--color-brass-deep)"
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}
