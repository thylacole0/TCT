/** @jsxImportSource preact */

interface DayCell {
  /** Single category color + intensity (0-1), or null for empty, or array of {color, pct} for split cells */
  data: { color: string; pct: number }[] | { color: string; intensity: number } | null;
  /** Whether this day has spending */
  hasSpending?: boolean;
  /** Is this today? */
  isToday?: boolean;
}

interface Props {
  weeks: DayCell[][];  // [week][day], 5 weeks × 7 days
  weekLabels?: string[];
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const EMPTY_STYLE = { background: "transparent", border: "1px dashed var(--border)" };
const SINGLE_STYLE = (color: string, intensity: number) => ({
  background: color, opacity: Math.max(0.1, intensity),
  borderRadius: "3px", aspectRatio: "1",
});
const TODAY_STYLE = { outline: "2px solid var(--text-secondary)", outlineOffset: "1px", zIndex: 1 };

function cellStyle(cell: DayCell): Record<string, string | number> {
  if (!cell) return { ...EMPTY_STYLE, aspectRatio: "1" };
  if (Array.isArray(cell.data)) {
    const cats = cell.data as { color: string; pct: number }[];
    if (cats.length >= 2) {
      const grad = `linear-gradient(to bottom, ${cats[0].color} ${cats[0].pct}%, ${cats[1].color} ${cats[0].pct}%)`;
      return { background: grad, opacity: "0.88", borderRadius: "3px", aspectRatio: "1", ...(cell.isToday ? TODAY_STYLE : {}) };
    }
    const c = cats[0];
    return { background: c.color, opacity: "0.88", borderRadius: "3px", aspectRatio: "1", ...(cell.isToday ? TODAY_STYLE : {}) };
  }
  const d = cell.data as { color: string; intensity: number };
  return { ...SINGLE_STYLE(d.color, d.intensity), ...(cell.isToday ? TODAY_STYLE : {}) };
}

export default function WeeklyHeatmap({ weeks, weekLabels }: Props) {
  return (
    <div class="wh-root">
      <div class="wh-header">
        {DAY_LABELS.map((d) => (
          <div key={d} class="wh-day-label">{d}</div>
        ))}
      </div>
      {(weeks || []).map((week, wi) => (
        <div key={wi} class="wh-row">
          {weekLabels && <div class="wh-week-label">{weekLabels[wi]}</div>}
          <div class="wh-cells">
            {week.map((cell, di) => (
              <div key={di} class="wh-cell" style={cellStyle(cell)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
