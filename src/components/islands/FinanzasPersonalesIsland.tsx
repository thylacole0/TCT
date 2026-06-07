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

const INCOME_KEY = "tct_personal_monthly_income";
const CATEGORY_COLORS: Record<string, string> = {
  Delivery: "#D71921",
  Supermercado: "#4A9E5C",
  Transporte: "#5B9BF6",
  "Gustos personales": "#D4A843",
  "Gastos del hogar": "#FF8C42",
  Suscripciones: "#9B59B6",
  Otros: "#999999",
};

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
  const segments = 10;
  return (
    <div class="fh-bar-track" style={{ marginTop: 4 }}>
      {Array.from({ length: segments }, (_, i) => {
        const segPct = ((i + 1) / segments) * 100;
        const filled = segPct <= pct;
        const warn = filled && pct > 75;
        return (
          <div
            key={i}
            class={`fh-bar-seg ${filled ? "fh-bar-seg-on" : ""}`}
            style={filled ? { background: warn ? "var(--warning)" : "var(--text-display)" } : undefined}
          />
        );
      })}
    </div>
  );
}

function transactionTitle(t: PersonalTransaction) {
  if (t.merchant && t.description && !t.description.toLowerCase().includes(t.merchant.toLowerCase())) {
    return `${t.merchant} · ${t.description}`;
  }
  return t.merchant || t.description || "Gasto personal";
}

function ReclassifySelect({
  current,
  expenseId,
  onDone,
}: {
  current: string;
  expenseId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (newCat: string) => {
    if (newCat === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/personal-expenses/reclassify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expenseId, category: newCat }),
      });
      if (res.ok) {
        onDone();
      }
    } catch { /*ignore*/ }
    setSaving(false);
    setOpen(false);
  };

  if (saving) return <span style={{ fontSize: 11, color: "var(--text-soft)", marginLeft: 8 }}>guardando…</span>;

  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 8 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          fontSize: 11,
          padding: "1px 6px",
          border: "1px solid var(--border)",
          borderRadius: 4,
          background: "var(--bg)",
          cursor: "pointer",
          color: CATEGORY_COLORS[current] || "#999",
        }}
        title="Cambiar categoría"
      >
        ✎ {current}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 10,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 4,
            minWidth: 160,
            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelect(cat)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                border: "none",
                background: cat === current ? "var(--accent-alpha)" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: cat === current ? "var(--accent)" : "var(--text)",
                fontWeight: cat === current ? 600 : 400,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-alpha)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = cat === current ? "var(--accent-alpha)" : "transparent")}
            >
              <span style={{ color: CATEGORY_COLORS[cat] || "#999", marginRight: 6 }}>●</span>
              {cat}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export default function FinanzasPersonalesIsland() {
  const [data, setData] = useState<ByCategoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Supermercado");
  const [income, setIncome] = useState(() => {
    try {
      const saved = localStorage.getItem(INCOME_KEY);
      const n = saved ? Number(saved) : 0;
      return n > 0 ? n : 0;
    } catch { return 0; }
  });
  const [incomeInput, setIncomeInput] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);

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
      const categories = CATEGORIES.map((category) =>
        json.categories.find((g) => g.category === category) || {
          category,
          total: 0,
          count: 0,
          transactions: [],
        }
      );
      setData({ ...json, categories });
    } catch {
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

  const handleIncomeSave = () => {
    const n = Number(incomeInput.replace(/\./g, "").replace(/\$/g, ""));
    if (n > 0) {
      setIncome(n);
      try { localStorage.setItem(INCOME_KEY, String(n)); } catch { /* ignore */ }
    }
    setEditingIncome(false);
    setIncomeInput("");
  };

  const categories = data?.categories || [];
  const monthTotal = data?.total_spent || 0;
  const hasExpenses = categories.some((g) => g.count > 0);
  const showIncomeBar = income > 0 && monthTotal > 0;
  const incomePct = income > 0 ? Math.min((monthTotal / income) * 100, 100) : 0;

  return (
    <div class="fh-root">
      {/* header + month nav */}
      <div class="fh-week-header">
        <span class="fh-label">FINANZAS PERSONALES</span>
        <div class="fp-month-nav">
          <button class="fp-nav-btn" onClick={goPrevMonth} aria-label="Mes anterior">←</button>
          <span class="fp-month-label">{monthName(currentMonth)}</span>
          <button class="fp-nav-btn" onClick={goNextMonth} aria-label="Mes siguiente">→</button>
        </div>
      </div>

      {/* sueldo mensual */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "var(--space-sm)",
          fontSize: 13,
        }}
      >
        <span class="fh-label" style={{ whiteSpace: "nowrap" }}>SUELDO MENSUAL</span>
        {editingIncome ? (
          <>
            <input
              type="text"
              value={incomeInput}
              onInput={(e) => setIncomeInput((e.target as HTMLInputElement).value)}
              placeholder={income > 0 ? formatCLP(income) : "Ej: 1200000"}
              style={{
                width: 140,
                padding: "2px 6px",
                fontSize: 13,
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--bg)",
                color: "var(--text)",
              }}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleIncomeSave(); if (e.key === "Escape") setEditingIncome(false); }}
            />
            <button
              onClick={handleIncomeSave}
              style={{
                padding: "2px 10px",
                fontSize: 12,
                border: "1px solid var(--accent)",
                borderRadius: 4,
                background: "var(--accent)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Guardar
            </button>
            <button
              onClick={() => setEditingIncome(false)}
              style={{ padding: "2px 6px", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--text-soft)" }}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>
              {income > 0 ? formatCLP(income) : "—"}
            </span>
            <button
              onClick={() => setEditingIncome(true)}
              style={{
                fontSize: 11,
                padding: "1px 6px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--bg)",
                cursor: "pointer",
              }}
            >
              {income > 0 ? "Editar" : "Configurar"}
            </button>
          </>
        )}
      </div>

      {/* dashboard hero */}
      <div class="fh-dashboard">
        <div class="fh-budget-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">GASTADO EN EL MES</span>
              <span class="fh-hero-value">{data ? formatCLP(monthTotal) : "—"}</span>
            </div>
            {showIncomeBar && (
              <div class="fh-hero-num" style={{ marginTop: 2 }}>
                <span class="fh-label">DEL SUELDO</span>
                <span class="fh-hero-value" style={{ fontSize: "var(--font-lg)" }}>
                  {incomePct.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          {showIncomeBar ? (
            <SpendingBar spent={monthTotal} total={income} />
          ) : data && monthTotal > 0 ? (
            <SpendingBar spent={monthTotal} total={monthTotal * 1.2} />
          ) : null}
          {showIncomeBar && (
            <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-soft)", marginTop: 2 }}>
              {formatCLP(monthTotal)} de {formatCLP(income)}
            </div>
          )}
        </div>
      </div>

      {/* loading / error */}
      {loading && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0" }}>[CARGANDO...]</div>}
      {error && <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-xl) 0", color: "var(--accent)" }}>[{error}]</div>}

      {data && !loading && !error && (
        <>
          {/* legend */}
          <div class="fh-section" style={{ marginTop: "var(--space-md)" }}>
            <span class="fh-label">RESUMEN POR CATEGORÍA</span>
            {hasExpenses ? (
              <div class="fh-pie-wrap" style={{ marginTop: "var(--space-sm)" }}>
                {categories.filter((g) => g.total > 0).map((group) => (
                  <div class="fh-pie-legend-item" key={group.category}>
                    <span class="fh-pie-dot" style={{ background: CATEGORY_COLORS[group.category] || CATEGORY_COLORS.Otros }} />
                    <span class="fh-pie-legend-label">{group.category}</span>
                    <span class="fh-pie-legend-pct">{monthTotal > 0 ? Math.round((group.total / monthTotal) * 100) : 0}%</span>
                    <span class="fh-pie-legend-val">{formatCLP(group.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div class="fh-empty" style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>[SIN GASTOS]</div>
            )}
          </div>

          {/* category list */}
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
                        <span class="fp-merchant-name">
                          <span style={{ color: CATEGORY_COLORS[group.category] || CATEGORY_COLORS.Otros, marginRight: 6 }}>●</span>
                          {group.category}
                        </span>
                        <span class="fp-merchant-meta">{group.count} {group.count === 1 ? "GASTO" : "GASTOS"}</span>
                      </div>
                      <div class="fp-merchant-right">
                        <span class="fp-merchant-total">{formatCLP(group.total)}</span>
                        <span
                          class="fp-chevron"
                          style={{
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform var(--duration-micro) var(--ease-out)",
                            display: "inline-block",
                          }}
                        >▼</span>
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
                        ) : (
                          group.transactions.map((t) => (
                            <div class="fp-transaction" key={t.id}>
                              <div class="fp-tx-left">
                                <span class="fp-tx-date">
                                  {shortDate(t.expense_date)}
                                  {t.display_time ? ` · ${t.display_time}` : ""}
                                </span>
                                <span class="fp-tx-desc">
                                  {transactionTitle(t)}
                                  <ReclassifySelect
                                    current={t.category}
                                    expenseId={t.id}
                                    onDone={() => fetchData(currentMonth)}
                                  />
                                </span>
                              </div>
                              <span class="fp-tx-amount">{formatCLP(t.amount)}</span>
                            </div>
                          ))
                        )}
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
