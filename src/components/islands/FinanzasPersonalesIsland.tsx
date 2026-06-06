/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";

// ─── Types ───
interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  merchant: string | null;
  expense_date: string;
  created_at: string;
}

interface MerchantGroup {
  merchant: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

interface ByMerchantResponse {
  merchants: MerchantGroup[];
  total_spent: number;
  from: string;
  to: string;
}

// ─── Helpers ───
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

// Stepped segment bar (like BudgetIsland)
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

// Simple category pie (mirrors BudgetIsland PieChart)
const PIE_COLORS = ["#FFFFFF", "#D71921", "#5B9BF6", "#4A9E5C", "#D4A843", "#999999", "#E8E8E8", "#666666", "#333333", "#FF6B6B"];

function MiniPie({ data }: { data: Array<[string, number]> }) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>[SIN GASTOS]</div>;

  return (
    <div class="fh-pie-wrap" style={{ marginTop: "var(--space-sm)" }}>
      {data.map(([label, value], i) => (
        <div class="fh-pie-legend-item" key={label}>
          <span class="fh-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
          <span class="fh-pie-legend-label">{label}</span>
          <span class="fh-pie-legend-pct">{Math.round((value / total) * 100)}%</span>
          <span class="fh-pie-legend-val">{formatCLP(value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───
export default function FinanzasPersonalesIsland() {
  const [data, setData] = useState<ByMerchantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [monthTotal, setMonthTotal] = useState(0);

  const fetchData = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    const { from, to } = monthBounds(date);
    try {
      const res = await fetch(`/api/expenses/by-merchant?from=${from}&to=${to}`);
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json: ByMerchantResponse = await res.json();
      setData(json);
      setMonthTotal(json.total_spent);
    } catch (e) {
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
    setExpandedMerchant(null);
  };

  const goNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
    setExpandedMerchant(null);
  };

  const toggleMerchant = (name: string) => {
    setExpandedMerchant(expandedMerchant === name ? null : name);
  };

  // Category totals from the data
  const categoryTotals: Record<string, number> = {};
  if (data) {
    for (const mg of data.merchants) {
      for (const t of mg.transactions) {
        const cat = t.category || "General";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
      }
    }
  }
  const catEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div class="fh-root">
      {/* Month navigation */}
      <div class="fh-week-header">
        <span class="fh-label">FINANZAS PERSONALES</span>
        <div class="fp-month-nav">
          <button class="fp-nav-btn" onClick={goPrevMonth} aria-label="Mes anterior">←</button>
          <span class="fp-month-label">{monthName(currentMonth)}</span>
          <button class="fp-nav-btn" onClick={goNextMonth} aria-label="Mes siguiente">→</button>
        </div>
      </div>

      {/* Total */}
      <div class="fh-dashboard">
        <div class="fh-budget-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">TOTAL GASTADO</span>
              <span class="fh-hero-value">{data ? formatCLP(monthTotal) : "—"}</span>
            </div>
          </div>
          {data && monthTotal > 0 && <SpendingBar spent={monthTotal} total={monthTotal * 1.2} />}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0" }}>[CARGANDO...]</div>}
      {error && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0", color: "var(--accent)" }}>[{error}]</div>}

      {data && !loading && !error && (
        <>
          {/* Category breakdown */}
          {catEntries.length > 0 && (
            <div class="fh-section" style={{ marginTop: "var(--space-md)" }}>
              <span class="fh-label">POR CATEGORÍA</span>
              <MiniPie data={catEntries} />
            </div>
          )}

          {/* Merchant groups */}
          {data.merchants.length === 0 ? (
            <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-2xl) 0" }}>
              [NO HAY GASTOS EN ESTE MES]
            </div>
          ) : (
            <div class="fp-merchant-list" style={{ marginTop: "var(--space-md)" }}>
              <span class="fh-label">POR COMERCIO</span>
              {data.merchants.map((mg) => {
                const isExpanded = expandedMerchant === mg.merchant;
                return (
                  <div class="fp-merchant-group" key={mg.merchant}>
                    <button
                      class="fp-merchant-header"
                      onClick={() => toggleMerchant(mg.merchant)}
                      aria-expanded={isExpanded}
                    >
                      <div class="fp-merchant-info">
                        <span class="fp-merchant-name">{mg.merchant}</span>
                        <span class="fp-merchant-meta">{mg.count} {mg.count === 1 ? "GASTO" : "GASTOS"}</span>
                      </div>
                      <div class="fp-merchant-right">
                        <span class="fp-merchant-total">{formatCLP(mg.total)}</span>
                        <span class="fp-chevron" style={{
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform var(--duration-micro) var(--ease-out)",
                          display: "inline-block",
                        }}>▼</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div class="fp-transactions">
                        {mg.transactions.map((t) => (
                          <div class="fp-transaction" key={t.id}>
                            <div class="fp-tx-left">
                              <span class="fp-tx-date">{shortDate(t.expense_date)}</span>
                              <span class="fp-tx-desc">{t.description}</span>
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
