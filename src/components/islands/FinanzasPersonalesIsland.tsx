/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import { CATEGORIES } from "../../lib/personalExpenses.js";

interface PersonalTransaction {
  id: string;
  amount: number;
  description: string | null;
  category: string;
  merchant: string | null;
  expense_date: string;
  expense_time: string | null;
  display_time: string | null;
  created_at: string;
  source?: string | null;
  card_last4?: string | null;
}

interface CategoryGroup {
  category: string;
  total: number;
  count: number;
  transactions: PersonalTransaction[];
}

interface ByCategoryResponse {
  categories: CategoryGroup[];
  total_spent: number;
  from: string;
  to: string;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function shortDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit" }).toUpperCase();
}

function monthName(date: Date) {
  return date.toLocaleDateString("es-CL", { month: "long", year: "numeric" }).toUpperCase();
}

function monthBounds(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function SpendingBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  return (
    <div class="fh-bar-track" style={{ marginTop: 0 }}>
      {Array.from({ length: 10 }, (_, i) => {
        const segPct = ((i + 1) / 10) * 100;
        const filled = segPct <= pct;
        return (
          <div
            class={`fh-bar-seg ${filled ? "fh-bar-seg-on" : ""}`}
            style={filled && pct > 75 ? { background: "var(--warning)" } : filled ? { background: "var(--text-display)" } : undefined}
          />
        );
      })}
    </div>
  );
}

const CATEGORY_ACCENTS: Record<string, string> = {
  Delivery: "#D71921",
  Supermercado: "#4A9E5C",
  Transporte: "#5B9BF6",
  "Gustos personales": "#D4A843",
  Otros: "#999999",
};

function CategoryLegend({ categories, total }: { categories: CategoryGroup[]; total: number }) {
  if (total === 0) {
    return <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>[SIN GASTOS]</div>;
  }

  return (
    <div class="fh-pie-wrap" style={{ marginTop: "var(--space-sm)" }}>
      {categories.map((group) => (
        <div class="fh-pie-legend-item" key={group.category}>
          <span class="fh-pie-dot" style={{ background: CATEGORY_ACCENTS[group.category] || CATEGORY_ACCENTS.Otros }} />
          <span class="fh-pie-legend-label">{group.category}</span>
          <span class="fh-pie-legend-pct">{total > 0 ? Math.round((group.total / total) * 100) : 0}%</span>
          <span class="fh-pie-legend-val">{formatCLP(group.total)}</span>
        </div>
      ))}
    </div>
  );
}

function transactionTitle(t: PersonalTransaction) {
  if (t.merchant && t.description && !t.description.toLowerCase().includes(t.merchant.toLowerCase())) {
    return `${t.merchant} · ${t.description}`;
  }
  return t.merchant || t.description || "Gasto personal";
}

export default function FinanzasPersonalesIsland() {
  const [data, setData] = useState<ByCategoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Supermercado");

  const fetchData = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    const { from, to } = monthBounds(date);
    try {
      const res = await fetch(`/api/personal-expenses/by-category?from=${from}&to=${to}`);
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json: ByCategoryResponse = await res.json();
      const categories = CATEGORIES.map((category) => json.categories.find((group) => group.category === category) || {
        category,
        total: 0,
        count: 0,
        transactions: [],
      });
      setData({ ...json, categories });
    } catch (_) {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth);
  }, [currentMonth, fetchData]);

  const goPrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
    setExpandedCategory(null);
  };

  const goNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
    setExpandedCategory(null);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const categories = data?.categories || [];
  const monthTotal = data?.total_spent || 0;
  const hasExpenses = categories.some((group) => group.count > 0);

  return (
    <div class="fh-root">
      <div class="fh-week-header">
        <span class="fh-label">FINANZAS PERSONALES</span>
        <div class="fp-month-nav">
          <button class="fp-nav-btn" onClick={goPrevMonth} aria-label="Mes anterior">←</button>
          <span class="fp-month-label">{monthName(currentMonth)}</span>
          <button class="fp-nav-btn" onClick={goNextMonth} aria-label="Mes siguiente">→</button>
        </div>
      </div>

      <div class="fh-dashboard">
        <div class="fh-budget-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">TOTAL GASTADO CON MI TARJETA</span>
              <span class="fh-hero-value">{data ? formatCLP(monthTotal) : "—"}</span>
            </div>
          </div>
          {data && monthTotal > 0 && <SpendingBar spent={monthTotal} total={monthTotal * 1.2} />}
        </div>
      </div>

      {loading && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0" }}>[CARGANDO...]</div>}
      {error && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0", color: "var(--accent)" }}>[{error}]</div>}

      {data && !loading && !error && (
        <>
          <div class="fh-section" style={{ marginTop: "var(--space-md)" }}>
            <span class="fh-label">RESUMEN POR CATEGORÍA</span>
            <CategoryLegend categories={categories} total={monthTotal} />
          </div>

          {!hasExpenses ? (
            <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-2xl) 0" }}>
              [NO HAY GASTOS PERSONALES EN ESTE MES]
            </div>
          ) : (
            <div class="fp-merchant-list" style={{ marginTop: "var(--space-md)" }}>
              <span class="fh-label">CATEGORÍAS</span>
              {categories.map((group) => {
                const isExpanded = expandedCategory === group.category;
                return (
                  <div class="fp-merchant-group" key={group.category}>
                    <button
                      class="fp-merchant-header"
                      onClick={() => toggleCategory(group.category)}
                      aria-expanded={isExpanded}
                    >
                      <div class="fp-merchant-info">
                        <span class="fp-merchant-name">{group.category}</span>
                        <span class="fp-merchant-meta">{group.count} {group.count === 1 ? "GASTO" : "GASTOS"}</span>
                      </div>
                      <div class="fp-merchant-right">
                        <span class="fp-merchant-total">{formatCLP(group.total)}</span>
                        <span class="fp-chevron" style={{
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform var(--duration-micro) var(--ease-out)",
                          display: "inline-block",
                        }}>▼</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div class="fp-transactions">
                        {group.transactions.length === 0 ? (
                          <div class="fp-transaction">
                            <div class="fp-tx-left">
                              <span class="fp-tx-date">SIN MOVIMIENTOS</span>
                              <span class="fp-tx-desc">No hay gastos en esta categoría.</span>
                            </div>
                          </div>
                        ) : group.transactions.map((t) => (
                          <div class="fp-transaction" key={t.id}>
                            <div class="fp-tx-left">
                              <span class="fp-tx-date">
                                {shortDate(t.expense_date)}{t.display_time ? ` · ${t.display_time}` : ""}
                              </span>
                              <span class="fp-tx-desc">{transactionTitle(t)}</span>
                            </div>
                            <span class="fp-tx-amount">{formatCLP(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
