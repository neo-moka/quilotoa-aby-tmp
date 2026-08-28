import { AbyMark } from "@/shared/ui/buzz-logo/AbyMark";

/**
 * Landing backdrop: a honeycomb lattice that reads as circuitry rather than as
 * insects. A diagonal wave lights cells in sequence, and a sparse set of nodes
 * holds a brighter glow, so the field looks like a hive being addressed by a
 * machine.
 *
 * The layout is derived, never random: screenshot specs diff this screen, so
 * the same viewport must always produce the same lattice.
 */

/** Flat-top hexagon radius, in viewBox units. */
const R = 46;
/** Flat-top packing: columns advance 1.5R, rows a full √3·R. */
const COL_STEP = R * 1.5;
const ROW_STEP = R * Math.sqrt(3);
const VIEW_W = 1440;
const VIEW_H = 900;
/** One extra ring past each edge so `slice` never reveals a cut lattice. */
const COLS = Math.ceil(VIEW_W / COL_STEP) + 2;
const ROWS = Math.ceil(VIEW_H / ROW_STEP) + 2;
/** Seconds for the diagonal wave to cross the lattice once. */
const WAVE_PERIOD = 7;

type Cell = {
  key: string;
  points: string;
  /** Animation offset, staggering the wave along the diagonal. */
  delay: number;
  /** Sparse brighter nodes, picked deterministically. */
  isNode: boolean;
};

function hexPoints(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(
      `${(cx + R * Math.cos(angle)).toFixed(2)},${(cy + R * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

function buildCells(): Cell[] {
  const cells: Cell[] = [];
  for (let col = -1; col < COLS; col += 1) {
    for (let row = -1; row < ROWS; row += 1) {
      const cx = col * COL_STEP;
      // Odd columns drop half a row so the flat-top hexagons interlock.
      const cy = row * ROW_STEP + (col % 2 === 0 ? 0 : ROW_STEP / 2);
      // Diagonal wavefront: delay grows with col + row, wrapped to the period.
      const delay = ((col * 0.9 + row * 1.4) % WAVE_PERIOD) - WAVE_PERIOD;
      cells.push({
        key: `${col}:${row}`,
        points: hexPoints(cx, cy),
        delay,
        // A fixed 1-in-11 walk keeps highlighted nodes scattered but stable.
        isNode: (col * 7 + row * 3) % 11 === 0,
      });
    }
  }
  return cells;
}

const CELLS = buildCells();

export function LandingHoneycomb() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        className="buzz-honeycomb absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        <title>Honeycomb lattice</title>
        <defs>
          {/* Fades the lattice out behind the wordmark and the CTAs so the
              centre of the screen stays quiet and legible. */}
          <radialGradient
            cx="50%"
            cy="48%"
            id="buzz-honeycomb-vignette"
            r="62%"
          >
            <stop offset="0%" stopColor="#000" stopOpacity="1" />
            <stop offset="42%" stopColor="#000" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="buzz-honeycomb-mask">
            {/* White reveals, black hides: invert the vignette so the lattice
                is strongest at the edges and dissolves toward the centre. */}
            <rect fill="#fff" height={VIEW_H} width={VIEW_W} x="0" y="0" />
            <rect
              fill="url(#buzz-honeycomb-vignette)"
              height={VIEW_H}
              width={VIEW_W}
              x="0"
              y="0"
            />
          </mask>
        </defs>
        <g mask="url(#buzz-honeycomb-mask)">
          {CELLS.map((cell) => (
            <polygon
              className={
                cell.isNode
                  ? "buzz-honeycomb-cell buzz-honeycomb-cell--node"
                  : "buzz-honeycomb-cell"
              }
              key={cell.key}
              points={cell.points}
              style={{ animationDelay: `${cell.delay}s` }}
            />
          ))}
        </g>
      </svg>
      <span className="absolute left-6 top-12 block w-11 text-foreground/80">
        <AbyMark className="h-auto w-full" />
      </span>
    </div>
  );
}
