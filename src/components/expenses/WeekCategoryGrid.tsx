/** @jsxImportSource preact */
import { CATEGORIES, CATEGORY_COLORS } from "../../lib/personalExpenses.js";

interface WeekData {
  label: string;
  range?: string;
  values: Record<string, number>;
}

interface Props {
  weeks: WeekData[];
  totals: Record<string, number>;
  grandTotal: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  Delivery: "Delivery",
  Supermercado: "Super.",
  Transporte: "Transp.",
  "Gustos personales": "Gustos",
  "Gastos del hogar": "Hogar",
  Suscripciones: "Suscr.",
  Otros: "Otros",
};

// Categories whose TOTAL reads as "bad spending" and is highlighted red in the
// prototype (Delivery, Otros). Everything else stays white.
const RED_TOTAL_CATEGORIES = new Set(["Delivery", "Otros"]);

function formatShort(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function formatShortMoney(n: number) {
  return `$${formatShort(n)}`;
}

// Opacity of a cell's category colour, proportional to the amount relative to
// the busiest cell in the whole grid. Mirrors the prototype: empty cells are a
// faint white wash, spent cells ride a 0.18 → 0.88 ramp on the category colour.
function cellOpacity(amount: number, maxAmount: number): number {
  const ratio = Math.min(1, amount / Math.max(1, maxAmount));
  return 0.18 + ratio * 0.7;
}

export default function WeekCategoryGrid({ weeks, totals, grandTotal }: Props) {
  const activeCategories = CATEGORIES.filter((c) => totals[c] > 0);
  const maxVal = Math.max(1, ...weeks.flatMap((w) => Object.values(w.values)));
  const weekTotals = weeks.map((w) => Object.values(w.values).reduce((s, v) => s + v, 0));
  // The two biggest weeks get bold white totals in the SEMANA row (prototype).
  const topWeekValues = [...weekTotals].sort((a, b) => b - a).slice(0, 2).filter((v) => v > 0);
  const isTopWeek = (total: number) => total > 0 && topWeekValues.includes(total);

  const topWeekIndex = weekTotals.reduce((best, total, index) => total > weekTotals[best] ? index : best, 0);
  const topWeek = weeks[topWeekIndex];
  const topWeekTotal = weekTotals[topWeekIndex] || 0;
  const topWeekCategories = topWeek
    ? Object.entries(topWeek.values).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
    : [];
  const leadingCategory = topWeekCategories[0]?.[0] || "Sin gastos";
  const leadingPct = topWeekTotal > 0 ? Math.round((topWeekCategories[0]?.[1] || 0) / topWeekTotal * 100) : 0;

  // Explicit columns so the week cells always fill the row exactly (no auto-fit
  // collapse / trailing gap): a fixed label + one equal track per week + total.
  const gridStyle = {
    gridTemplateColumns: `88px repeat(${weeks.length}, minmax(0, 1fr)) 52px`,
  };

  return (
    <div class="wcg-root">
      <div class="wcg-grid">
        <div class="wcg-row wcg-header" style={gridStyle}>
          <div class="wcg-label" />
          {weeks.map((w) => (
            <div key={w.label} class="wcg-col-header">
              <span class="wcg-col-name">{w.label}</span>
              {w.range && <span class="wcg-col-range">{w.range}</span>}
            </div>
          ))}
          <div class="wcg-col-header wcg-col-total">
            <span class="wcg-col-name">TOTAL</span>
          </div>
        </div>

        {activeCategories.map((cat) => {
          const color = CATEGORY_COLORS[cat] || "#999";
          const totalRed = RED_TOTAL_CATEGORIES.has(cat);
          return (
            <div key={cat} class="wcg-row" style={gridStyle}>
              <div class="wcg-label">
                <span class="wcg-dot" style={{ background: color }} />
                <span class="wcg-cat-name">{CATEGORY_LABELS[cat] || cat}</span>
              </div>
              {weeks.map((w) => {
                const val = w.values[cat] || 0;
                if (val <= 0) {
                  return <div key={w.label} class="wcg-cell wcg-cell-empty" />;
                }
                const opacity = cellOpacity(val, maxVal);
                // Bright cells need dark text for contrast; dim cells show the
                // category colour itself (matching the prototype).
                const bright = opacity >= 0.5;
                return (
                  <div
                    key={w.label}
                    class="wcg-cell"
                    style={{ background: color, opacity: String(opacity) }}
                  >
                    <span
                      class={`wcg-cell-val ${bright ? "wcg-cell-val-dark" : ""}`}
                      style={bright ? undefined : { color, opacity: String(Math.min(1, 0.8 / opacity)) }}
                    >
                      {formatShort(val)}
                    </span>
                  </div>
                );
              })}
              <div class="wcg-cell wcg-cell-total">
                <span class={`wcg-total-val ${totalRed ? "wcg-total-val-red" : ""}`}>
                  {formatShortMoney(totals[cat] || 0)}
                </span>
              </div>
            </div>
          );
        })}

        <div class="wcg-row wcg-footer" style={gridStyle}>
          <div class="wcg-label"><span class="wcg-footer-label">SEMANA</span></div>
          {weeks.map((w, index) => {
            const total = weekTotals[index];
            const cls = total <= 0 ? "wcg-footer-val-zero" : isTopWeek(total) ? "wcg-footer-val-top" : "";
            return (
              <div key={w.label} class="wcg-cell wcg-footer-cell">
                <span class={`wcg-footer-val ${cls}`}>{total > 0 ? formatShortMoney(total) : "$0"}</span>
              </div>
            );
          })}
          <div class="wcg-cell wcg-footer-cell wcg-cell-total">
            <span class="wcg-footer-val wcg-footer-val-grand">{formatShortMoney(grandTotal)}</span>
          </div>
        </div>
      </div>

      {topWeek && topWeekTotal > 0 && (
        <div class="wcg-insight wcg-insight-strong">
          <span class="wcg-insight-text">{topWeek.label} concentra el {grandTotal > 0 ? Math.round(topWeekTotal / grandTotal * 100) : 0}% del gasto total</span>
          <span class="wcg-insight-text">{CATEGORY_LABELS[leadingCategory] || leadingCategory} explica el {leadingPct}% dentro de esa semana</span>
        </div>
      )}
      <div class="wcg-insight">
        <span class="wcg-insight-text">Celda oscura = sin gasto · Celda brillante = mucho gasto esa semana</span>
      </div>
    </div>
  );
}
