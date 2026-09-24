/**
 * Balanced column counts for grids that must always show everyone (mentor lineups).
 * Everyone fits in one row up to `max`; beyond that, the width (max…3) that leaves the fewest empty
 * places in the last row, preferring wider rows on a tie. Six mentors with max 5 → three across.
 */
export function balancedColumns(count: number, max = 5): number {
  if (count <= max) return Math.max(1, count);
  let best = max;
  let bestEmpty = Number.POSITIVE_INFINITY;
  for (let cols = max; cols >= 3; cols--) {
    const empty = (cols - (count % cols)) % cols;
    if (empty < bestEmpty) {
      best = cols;
      bestEmpty = empty;
    }
  }
  return best;
}
