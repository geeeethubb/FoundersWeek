/**
 * OrbitField — the hero's large, quiet line-art: hairline orbits, one dashed ring, a crosshair and
 * a single orange point riding a short arc on the outer orbit (the same visual language as
 * MentorPortrait, at page scale). Purely decorative (aria-hidden); deterministic, so server and
 * client output match.
 */
import { cn } from "@/lib/cn";

const CX = 400;
const CY = 400;
const SQUASH = 0.94;
const RINGS = [70, 128, 196, 270, 352];

/** Point on ring `r` at `deg` (0° = 3 o'clock, clockwise), rounded for stable markup. */
function at(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: Math.round((CX + r * Math.cos(rad)) * 10) / 10,
    y: Math.round((CY + r * SQUASH * Math.sin(rad)) * 10) / 10,
  };
}

export function OrbitField({ className }: { className?: string }) {
  const outer = RINGS[4];
  const arcFrom = at(outer, -30);
  const arcTo = at(outer, 22);
  const point = at(outer, -4);
  return (
    <svg viewBox="0 0 800 800" className={cn("pointer-events-none select-none", className)} aria-hidden focusable="false">
      <g fill="none" transform={`rotate(-14 ${CX} ${CY})`}>
        {RINGS.map((r, i) => (
          <ellipse
            key={r}
            cx={CX}
            cy={CY}
            rx={r}
            ry={r * SQUASH}
            stroke="rgb(244 239 231)"
            strokeOpacity={i === 4 ? 0.1 : i === 2 ? 0.12 : 0.06}
            strokeWidth={i === 2 ? 1.25 : 1}
            strokeDasharray={i === 3 ? "3 7" : undefined}
          />
        ))}
        <path
          d={`M ${arcFrom.x} ${arcFrom.y} A ${outer} ${outer * SQUASH} 0 0 1 ${arcTo.x} ${arcTo.y}`}
          stroke="#ff5f05"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line x1={CX} y1={CY} x2={point.x} y2={point.y} stroke="#ff5f05" strokeOpacity={0.3} strokeDasharray="2 6" />
        <circle cx={point.x} cy={point.y} r={4.5} fill="#ff5f05" />
        <circle cx={point.x} cy={point.y} r={12} stroke="#ff5f05" strokeOpacity={0.4} />
        {/* Survey ticks along the axis */}
        {Array.from({ length: 17 }, (_, i) => {
          const x = 80 + i * 40;
          const long = i % 4 === 0;
          return (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={CY - (long ? 7 : 3)}
              y2={CY + (long ? 7 : 3)}
              stroke="rgb(244 239 231)"
              strokeOpacity={long ? 0.2 : 0.1}
            />
          );
        })}
      </g>
      <path d={`M${CX - 9} ${CY}H${CX + 9}M${CX} ${CY - 9}V${CY + 9}`} stroke="rgb(244 239 231)" strokeOpacity={0.3} />
    </svg>
  );
}
