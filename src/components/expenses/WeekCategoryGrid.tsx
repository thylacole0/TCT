/** @jsxImportSource preact */
import { CATEGORIES, CATEGORY_COLORS } from "../../lib/personalExpenses.js";

interface WeekData {
  label: string;
  values: Record<string, number>;  // category -> amount
}

interface Props {
  weeks: WeekData[];
  totals: Record<string, number>;
  grandTotal: number;
}

function intensityStyle(amount: number, maxAmount: number): Record<string, string> {
  if (amount <= 0) return { background: "var(--surface)", opacity: "0.3" };
  const ratio = Math.min(1, amount / Math.max(1, maxAmount));
  // Map ratio 0-1 to opacity 0.18-0.92
  const opacity = 0.18 + ratio * 0.74;
  return { background: "currentColor", opacity: String(opacity) };
}

export default function WeekCategoryGrid({ weeks, totals, grandTotal }: Props) {
  const activeCategories = CATEGORIES.filter((c) => totals[c] > 0);
  const maxVal = Math.max(1, ...Object.values(totals));

  return (
    <div class="wcg-root">
      <div class="wcg-grid">
        {/* Header row */}
        <div class="wcg-row wcg-header">
          <div class="wcg-label" />
          {weeks.map((w) => (
            <div key={w.label} class="wcg-col-header">
              <span class="wcg-col-name">{w.label}</span>
            </div>
          ))}
          <div class="wcg-col-header wcg-col-total">
            <span class="wcg-col-name">TOTAL</span>
          </div>
        </div>

        {/* Category rows */}
        {activeCategories.map((cat) => (
          <div key={cat} class="wcg-row">
            <div class="wcg-label">
              <span class="wcg-dot" style={{ background: CATEGORY_COLORS[cat] || "#999" }} />
              <span class="wcg-cat-name" style={{ color: "var(--text-primary)" }}>{cat}</span>
            </div>
            {weeks.map((w) => {
              const val = w.values[cat] || 0;
              return (
                <div key={w.label} class="wcg-cell" style={{ ...intensityStyle(val, maxVal), color: CATEGORY_COLORS[cat] || "#999" }}>
                  {val > 0 && <span class="wcg-cell-val">{val >= 1000 ? `${Math.round(val / 1000)}k` : val}</span>}
                </div>
              );
            })}
            <div class="wcg-cell wcg-cell-total">
              <span class="wcg-total-val">${(totals[cat] || 0).toLocaleString("es-CL")}</span>
            </div>
          </div>
        ))}

        {/* Totals row */}
        <div class="wcg-row wcg-footer">
          <div class="wcg-label">
            <span class="wcg-footer-label">SEMANA</span>
          </div>
          {weeks.map((w) => {
            const weekTotal = Object.values(w.values).reduce((s, v) => s + v, 0);
            return (
              <div key={w.label} class="wcg-cell wcg-footer-cell">
                <span class="wcg-footer-val">{weekTotal > 0 ? `$${Math.round(weekTotal).toLocaleString("es-CL")}` : "$0"}</span>
              </div>
            );
          })}
          <div class="wcg-cell wcg-footer-cell wcg-cell-total">
            <span class="wcg-footer-val" style="font-weight:700">${grandTotal.toLocaleString("es-CL")}</span>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div class="wcg-insight">
        <span class="wcg-insight-text">Celda oscura = sin gasto · Celda brillante = más gasto esa semana</span>
      </div>
    </div>
  );
}
