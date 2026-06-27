/** @jsxImportSource preact */
import { CATEGORIES, CATEGORY_COLORS } from "../../lib/personalExpenses.js";

interface WeekData {
  label: string;
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

function formatShort(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}


function intensityStyle(amount: number, maxAmount: number): Record<string, string> {
  if (amount <= 0) return { background: "var(--surface)", opacity: "0.28" };
  const ratio = Math.min(1, amount / Math.max(1, maxAmount));
  const opacity = 0.2 + ratio * 0.78;
  return { background: "currentColor", opacity: String(opacity) };
}

export default function WeekCategoryGrid({ weeks, totals, grandTotal }: Props) {
  const activeCategories = CATEGORIES.filter((c) => totals[c] > 0);
  const maxVal = Math.max(1, ...weeks.flatMap((w) => Object.values(w.values)));
  const weekTotals = weeks.map((w) => Object.values(w.values).reduce((s, v) => s + v, 0));
  const topWeekIndex = weekTotals.reduce((best, total, index) => total > weekTotals[best] ? index : best, 0);
  const topWeek = weeks[topWeekIndex];
  const topWeekTotal = weekTotals[topWeekIndex] || 0;
  const topWeekCategories = topWeek
    ? Object.entries(topWeek.values).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
    : [];
  const leadingCategory = topWeekCategories[0]?.[0] || "Sin gastos";
  const leadingPct = topWeekTotal > 0 ? Math.round((topWeekCategories[0]?.[1] || 0) / topWeekTotal * 100) : 0;

  return (
    <div class="wcg-root">
      <div class="wcg-grid">
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

        {activeCategories.map((cat) => (
          <div key={cat} class="wcg-row">
            <div class="wcg-label">
              <span class="wcg-dot" style={{ background: CATEGORY_COLORS[cat] || "#999" }} />
              <span class="wcg-cat-name" style={{ color: "var(--text-primary)" }}>{CATEGORY_LABELS[cat] || cat}</span>
            </div>
            {weeks.map((w) => {
              const val = w.values[cat] || 0;
              return (
                <div key={w.label} class="wcg-cell" style={{ ...intensityStyle(val, maxVal), color: CATEGORY_COLORS[cat] || "#999" }}>
                  {val > 0 && <span class="wcg-cell-val">{formatShort(val)}</span>}
                </div>
              );
            })}
            <div class="wcg-cell wcg-cell-total">
              <span class="wcg-total-val">{formatShort(totals[cat] || 0)}</span>
            </div>
          </div>
        ))}

        <div class="wcg-row wcg-footer">
          <div class="wcg-label"><span class="wcg-footer-label">SEMANA</span></div>
          {weeks.map((w, index) => (
            <div key={w.label} class="wcg-cell wcg-footer-cell">
              <span class="wcg-footer-val">{weekTotals[index] > 0 ? formatShort(weekTotals[index]) : "$0"}</span>
            </div>
          ))}
          <div class="wcg-cell wcg-footer-cell wcg-cell-total">
            <span class="wcg-footer-val" style="font-weight:700">{formatShort(grandTotal)}</span>
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