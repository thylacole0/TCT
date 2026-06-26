/** @jsxImportSource preact */
import { CATEGORY_COLORS } from "../../lib/personalExpenses.js";
import CategoryDonut from "./CategoryDonut";
import TctIcon from "../icons/TctIcon";

interface CategoryGroup {
  category: string;
  total: number;
  count: number;
  transactions: unknown[];
}

interface Props {
  categories: CategoryGroup[];
  totalSpent: number;
  categoryBudgets: Record<string, number>;
  onOpenBudgets: () => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function pct(val: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((val / total) * 100);
}

export default function CategorySummaryEnhanced({ categories, totalSpent, categoryBudgets, onOpenBudgets }: Props) {
  // Build donut data
  const activeCategories = categories.filter((g) => g.total > 0);
  const donutData = activeCategories.map((g) => ({
    category: g.category,
    total: g.total,
    color: CATEGORY_COLORS[g.category] || "#999",
    pct: pct(g.total, totalSpent),
  }));

  // Sort by total descending for cards
  const sorted = [...categories].sort((a, b) => b.total - a.total);
  const hasExpenses = totalSpent > 0;

  if (!hasExpenses) {
    return (
      <div class="cs-empty">[SIN GASTOS EN ESTE PERÍODO]</div>
    );
  }

  return (
    <div class="cs-root">
      {/* Donut chart */}
      <div class="cs-donut-section">
        <CategoryDonut categories={donutData} total={totalSpent} size={180} />
      </div>

      {/* Top categories highlight */}
      <div class="cs-top-section">
        <span class="cs-label">TOP CATEGORÍAS</span>
        <div class="cs-top-grid">
          {sorted.slice(0, 3).filter(g => g.total > 0).map((g, i) => {
            const budget = Number(categoryBudgets[g.category] || 0);
            const budgetPct = budget > 0 ? (g.total / budget) * 100 : 0;
            const over = budgetPct > 100;
            return (
              <div class={`cs-top-card ${i === 0 ? "cs-top-primary" : ""}`} key={g.category}>
                <div class="cs-top-dot" style={{ background: CATEGORY_COLORS[g.category] || "#999" }} />
                <span class="cs-top-name">{g.category}</span>
                <span class="cs-top-amount">{formatCLP(g.total)}</span>
                <span class="cs-top-meta">
                  {g.count} {g.count === 1 ? "gasto" : "gastos"} · {pct(g.total, totalSpent)}%
                </span>
                {budget > 0 && (
                  <div class="cs-top-budget">
                    <div class="cs-mini-bar">
                      <div class={`cs-mini-fill ${over ? "cs-over" : ""}`} style={{ width: `${Math.min(budgetPct, 100)}%`, background: CATEGORY_COLORS[g.category] || "#999" }} />
                    </div>
                    <span class={`cs-mini-pct ${over ? "cs-over-text" : ""}`}>{over ? "EXCEDIDO" : `${Math.round(budgetPct)}%`}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* All categories */}
      <div class="cs-all-section">
        <div class="cs-all-header">
          <span class="cs-label">TODAS LAS CATEGORÍAS</span>
          <button class="cs-budget-btn" onClick={onOpenBudgets}>
            <TctIcon name="edit" size={13} variant="dots" /> PRESUPUESTOS
          </button>
        </div>
        <div class="cs-all-list">
          {sorted.map((g) => {
            const budget = Number(categoryBudgets[g.category] || 0);
            const sharePct = pct(g.total, totalSpent);
            const budgetPct = budget > 0 ? (g.total / budget) * 100 : 0;
            return (
              <div class="cs-row" key={g.category}>
                <div class="cs-row-left">
                  <span class="cs-row-dot" style={{ background: CATEGORY_COLORS[g.category] || "#999" }} />
                  <div class="cs-row-info">
                    <span class="cs-row-name">{g.category}</span>
                    <span class="cs-row-meta">{g.count} gastos · {sharePct}% del total</span>
                  </div>
                </div>
                <div class="cs-row-right">
                  <span class="cs-row-amount">{formatCLP(g.total)}</span>
                  {budget > 0 && (
                    <div class="cs-row-budget-bar">
                      <div class="cs-mini-bar cs-mini-bar-wide">
                        <div
                          class="cs-mini-fill"
                          style={{
                            width: `${Math.min(budgetPct, 100)}%`,
                            background: budgetPct > 100 ? "#EF4444" : (CATEGORY_COLORS[g.category] || "#999"),
                          }}
                        />
                      </div>
                      <span class="cs-row-budget-label">
                        {formatCLP(budget)} · {Math.round(budgetPct)}%
                        {budgetPct > 100 && " ⚠"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
