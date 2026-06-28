/** @jsxImportSource preact */
import { useState } from "preact/hooks";

interface CategoryBreakdown {
  category: string;
  color: string;
  amount: number;
  pct: number;
}

interface DayCell {
  /** Single category color + intensity (0-1), or array of {color, pct} for split cells */
  data: { color: string; pct: number }[] | { color: string; intensity: number };
  /** Whether this day has spending */
  hasSpending?: boolean;
  /** Is this today? */
  isToday?: boolean;
  /** ISO date (YYYY-MM-DD) */
  date?: string;
  /** Human label, e.g. "VIE 19 JUN" */
  dateLabel?: string;
  /** Total spent that day */
  total?: number;
  /** Per-category breakdown for the detail panel */
  breakdown?: CategoryBreakdown[];
}

interface Props {
  weeks: (DayCell | null)[][];  // [week][day], 5 weeks × 7 days
  weekLabels?: string[];
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const EMPTY_STYLE = { background: "rgba(255, 255, 255, 0.04)" };
const SINGLE_STYLE = (color: string, intensity: number) => ({
  background: color, opacity: Math.max(0.1, intensity),
});

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function cellStyle(cell: DayCell | null): Record<string, string | number> {
  if (!cell) return { ...EMPTY_STYLE };
  if (Array.isArray(cell.data)) {
    const cats = cell.data as { color: string; pct: number }[];
    if (cats.length >= 2) {
      // Soft blend across the split instead of a hard line: the two colors
      // hold solid at the edges and fade through each other in a band centered
      // on the proportional split point.
      const split = cats[0].pct;
      const band = 18; // width of the transition zone, in %
      const start = Math.max(0, split - band / 2);
      const end = Math.min(100, split + band / 2);
      const grad = `linear-gradient(to bottom, ${cats[0].color} ${start}%, ${cats[1].color} ${end}%)`;
      return { background: grad, opacity: "0.88" };
    }
    const c = cats[0];
    return { background: c.color, opacity: "0.88" };
  }
  const d = cell.data as { color: string; intensity: number };
  return { ...SINGLE_STYLE(d.color, d.intensity) };
}

export default function WeeklyHeatmap({ weeks, weekLabels }: Props) {
  const [selected, setSelected] = useState<DayCell | null>(null);

  // Resolve the selected cell from the latest data (so re-renders keep it fresh)
  // by matching its ISO date; fall back to today's cell if nothing is selected.
  const todayCell = (weeks || []).flat().find((c) => c?.isToday) || null;
  const active = selected
    ? (weeks || []).flat().find((c) => c?.date === selected.date) || null
    : todayCell;

  // One unified grid: an optional week-label column + 7 equal day columns. The
  // header and every week row share the exact same tracks, so day headers,
  // week labels and cells always line up and cells stay square.
  const gridStyle = {
    gridTemplateColumns: `${weekLabels ? "24px " : ""}repeat(7, minmax(0, 1fr))`,
  };

  return (
    <div class="wh-root">
      <div class="wh-grid" style={gridStyle}>
        {weekLabels && <div class="wh-corner" />}
        {DAY_LABELS.map((d) => (
          <div key={`h-${d}`} class="wh-day-label">{d}</div>
        ))}

        {(weeks || []).map((week, wi) => [
          weekLabels ? <div key={`wl-${wi}`} class="wh-week-label">{weekLabels[wi]}</div> : null,
          ...week.map((cell, di) => {
            const isActive = Boolean(cell?.date && active?.date === cell.date);
            const classes = [
              "wh-cell",
              cell ? "wh-cell-filled" : "wh-cell-empty",
              cell?.isToday ? "wh-cell-today" : "",
              isActive ? "wh-cell-active" : "",
            ].filter(Boolean).join(" ");
            return cell ? (
              <button
                key={`c-${wi}-${di}`}
                type="button"
                class={classes}
                style={cellStyle(cell)}
                aria-label={cell.dateLabel}
                aria-pressed={isActive}
                onClick={() => setSelected(cell)}
              />
            ) : (
              <div key={`c-${wi}-${di}`} class={classes} style={cellStyle(cell)} />
            );
          }),
        ])}
      </div>

      {active && active.breakdown && active.breakdown.length > 0 && (
        <div class="wh-detail">
          <div class="wh-detail-head">
            <span class="wh-detail-date">
              {active.dateLabel}{active.isToday ? " (HOY)" : ""}
            </span>
            <span class="wh-detail-total">{formatCLP(active.total || 0)}</span>
          </div>
          <div class="wh-detail-cats">
            {active.breakdown.map((b) => (
              <div key={b.category} class="wh-detail-cat">
                <span class="wh-detail-swatch" style={{ background: b.color }} />
                <span class="wh-detail-cat-name">{b.category}</span>
                <span class="wh-detail-cat-amount">{formatCLP(b.amount)}</span>
                <span class="wh-detail-cat-pct">{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
