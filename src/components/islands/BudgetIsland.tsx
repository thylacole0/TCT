/** @jsxImportSource preact */
import { useState, useCallback } from "preact/hooks";

// ─── Types ───
interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  user_name?: string;
  user_avatar?: string;
  budgetType?: "comida" | "aseo";
  items?: Array<{ name: string; quantity: number; unit_price: number }>;
}

interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

type BudgetType = "comida" | "aseo";
type ViewMode = "resumen" | "comida" | "aseo";

interface BudgetData {
  budgetWeekId?: string;
  budgetAmount: number;
  totalSpent: number;
  expenses: Expense[];
  categories: string[];
  dailySpending: Record<string, number>;
  categoryTotals: Array<[string, number]>;
  productTotals: Array<[string, number]>;
}

interface Props {
  weekLabel: string;
  aseoLabel: string;
  comida: BudgetData;
  aseo: BudgetData;
  isReadOnly?: boolean;
}

// ─── Helpers ───
function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function MiniAvatar({ url, name, size = 16 }: { url?: string; name?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  const letter = (name || '?')[0].toUpperCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: size * 0.6, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
      {letter}
    </span>
  );
}

// ─── Pie Chart ───
const PIE_COLORS = ["#FFFFFF", "#D71921", "#5B9BF6", "#4A9E5C", "#D4A843", "#999999", "#E8E8E8", "#666666", "#333333", "#FF6B6B"];

function PieChart({ data, size = 140 }: { data: Array<[string, number]>; size?: number }) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const r = size / 2;
  const cx = r;
  const cy = r;
  const innerR = r * 0.55;
  let cumAngle = -Math.PI / 2;

  const slices = data.map(([label, value], i) => {
    const angle = (value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    const endX = cx + r * Math.cos(cumAngle + angle);
    const endY = cy + r * Math.sin(cumAngle + angle);
    const innerStartX = cx + innerR * Math.cos(cumAngle + angle);
    const innerStartY = cy + innerR * Math.sin(cumAngle + angle);
    const innerEndX = cx + innerR * Math.cos(cumAngle);
    const innerEndY = cy + innerR * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${startX} ${startY}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`,
      `L ${innerStartX} ${innerStartY}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEndX} ${innerEndY}`,
      "Z",
    ].join(" ");

    cumAngle += angle;
    return <path key={i} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />;
  });

  return (
    <div class="fh-pie-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices}
      </svg>
      <div class="fh-pie-legend">
        {data.map(([label, value], i) => (
          <div class="fh-pie-legend-item" key={label}>
            <span class="fh-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span class="fh-pie-legend-label">{label}</span>
            <span class="fh-pie-legend-pct">{Math.round((value / total) * 100)}%</span>
            <span class="fh-pie-legend-val">{formatCLP(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function BudgetIsland({ weekLabel, aseoLabel, comida, aseo, isReadOnly }: Props) {
  const [view, setView] = useState<ViewMode>("resumen");

  // Tag expenses with their budget type
  const comidaExpenses = comida.expenses.map(e => ({ ...e, budgetType: "comida" as const }));
  const aseoExpenses = aseo.expenses.map(e => ({ ...e, budgetType: "aseo" as const }));
  const allExpenses = [...comidaExpenses, ...aseoExpenses].sort((a, b) => {
    if (a.expense_date > b.expense_date) return -1;
    if (a.expense_date < b.expense_date) return 1;
    return 0;
  });

  // Default expense filter follows the active view
  const defaultExpenseFilter: ExpenseFilter = view === "comida" ? "comida" : view === "aseo" ? "aseo" : "todos";

  return (
    <div class="fh-root">
      {/* View switcher */}
      <div class="fh-tabs">
        <button
          class={`fh-tab ${view === "resumen" ? "fh-tab-active" : ""}`}
          onClick={() => setView("resumen")}
        >
          RESUMEN
        </button>
        <button
          class={`fh-tab ${view === "comida" ? "fh-tab-active" : ""}`}
          onClick={() => setView("comida")}
        >
          COMIDA
        </button>
        <button
          class={`fh-tab ${view === "aseo" ? "fh-tab-active" : ""}`}
          onClick={() => setView("aseo")}
        >
          ASEO
        </button>
      </div>

      {/* Top section: summary or budget detail — uses display:none to preserve state */}
      <div class="fh-panel-wrapper">
        <div class="fh-panel" style={{ display: view === "resumen" ? "block" : "none" }}>
          <SummaryView weekLabel={weekLabel} aseoLabel={aseoLabel} comida={comida} aseo={aseo} />
        </div>
        <div class="fh-panel" style={{ display: view === "comida" ? "block" : "none" }}>
          <BudgetPanel
            data={{ ...comida, expenses: comidaExpenses }}
            periodLabel={weekLabel}
            budgetType="comida"
            isReadOnly={isReadOnly}
          />
        </div>
        <div class="fh-panel" style={{ display: view === "aseo" ? "block" : "none" }}>
          <BudgetPanel
            data={{ ...aseo, expenses: aseoExpenses }}
            periodLabel={aseoLabel}
            budgetType="aseo"
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Expense list — always mounted, never unmounts on tab switch */}
      <div class="bi-expense-section">
        <FilterableExpenseList expenses={allExpenses} viewFilter={defaultExpenseFilter} />
      </div>
    </div>
  );
}

// ─── Summary View (comparison) ───
function SummaryView({ weekLabel, aseoLabel, comida, aseo }: { weekLabel: string; aseoLabel: string; comida: BudgetData; aseo: BudgetData }) {
  const totalBudget = comida.budgetAmount + aseo.budgetAmount;
  const totalSpent = comida.totalSpent + aseo.totalSpent;
  const totalRemaining = totalBudget - totalSpent;

  // Merge daily spending
  const dayNames = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];
  const maxComidaDaily = Math.max(...Object.values(comida.dailySpending), 1);
  const maxAseoDaily = Math.max(...Object.values(aseo.dailySpending), 1);
  const maxDaily = Math.max(maxComidaDaily, maxAseoDaily, 1);

  return (
    <div class="fh-dashboard">
      <div class="fh-week-header">
        <span class="fh-label">RESUMEN</span>
        <span class="fh-label">{weekLabel}</span>
      </div>

      {/* Comparison cards */}
      <div class="bi-compare-grid">
        <BudgetCard label="COMIDA" amount={comida.budgetAmount} spent={comida.totalSpent} />
        <BudgetCard label="ASEO" amount={aseo.budgetAmount} spent={aseo.totalSpent} />
      </div>

      {/* Combined total */}
      {totalBudget > 0 && (
        <div class="bi-total-row">
          <div class="bi-total-pair">
            <span class="fh-label">TOTAL GASTADO</span>
            <span class="fh-hero-value" style={{ fontSize: 'var(--display-sm)' }}>{formatCLP(totalSpent)}</span>
          </div>
          <div class="bi-total-pair">
            <span class="fh-label">TOTAL PRESUPUESTO</span>
            <span class="fh-caption">{formatCLP(totalBudget)}</span>
          </div>
          <div class="bi-total-pair">
            <span class="fh-label">RESTANTE</span>
            <span style={{ color: totalRemaining >= 0 ? 'var(--success)' : 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 'var(--body)' }}>
              {formatCLP(totalRemaining)}
            </span>
          </div>
        </div>
      )}

      {/* Daily comparison chart */}
      {(comida.budgetAmount > 0 || aseo.budgetAmount > 0) && (
        <div class="fh-section fh-chart-card">
          <span class="fh-label">GASTO DIARIO COMPARADO</span>
          <div class="fh-daily-chart">
            {dayNames.map((day) => {
              const comidaAmt = comida.dailySpending[day] || 0;
              const aseoAmt = aseo.dailySpending[day] || 0;
              return (
                <div class="fh-daily-col" key={day}>
                  {(comidaAmt > 0 || aseoAmt > 0) && (
                    <span class="fh-daily-val">{formatCLP(comidaAmt + aseoAmt)}</span>
                  )}
                  <div class="fh-daily-track bi-stacked-track">
                    <div
                      class="fh-daily-fill"
                      style={{ height: `${(comidaAmt / maxDaily) * 100}%` }}
                      title={`Comida: ${formatCLP(comidaAmt)}`}
                    />
                    <div
                      class="fh-daily-fill bi-fill-aseo"
                      style={{ height: `${(aseoAmt / maxDaily) * 100}%` }}
                      title={`Aseo: ${formatCLP(aseoAmt)}`}
                    />
                  </div>
                  <span class="fh-daily-day">{day}</span>
                </div>
              );
            })}
          </div>
          <div class="bi-legend-row">
            <span class="bi-legend-item"><span class="bi-legend-dot" style={{ background: 'var(--text-display)' }} /> COMIDA</span>
            <span class="bi-legend-item"><span class="bi-legend-dot" style={{ background: 'var(--accent)' }} /> ASEO</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Budget Card (for summary) ───
function BudgetCard({ label, amount, spent }: { label: string; amount: number; spent: number }) {
  const remaining = amount - spent;
  const pct = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
  const overflow = spent > amount;

  return (
    <div class="bi-card">
      <span class="fh-label">{label}</span>
      {amount > 0 ? (
        <>
          <span class="bi-card-spent" style={{ color: overflow ? 'var(--accent)' : 'var(--text-display)' }}>
            {formatCLP(spent)}
          </span>
          <span class="fh-caption">DE {formatCLP(amount)}</span>
          <div class="fh-bar-track" style={{ marginTop: 'var(--space-xs)' }}>
            {Array.from({ length: 10 }, (_, i) => {
              const segPct = ((i + 1) / 10) * 100;
              const filled = segPct <= pct;
              const color = overflow ? "var(--accent)" : pct > 75 ? "var(--warning)" : "var(--text-display)";
              return (
                <div
                  class={`fh-bar-seg ${filled ? "fh-bar-seg-on" : ""}`}
                  style={filled ? { background: color } : undefined}
                />
              );
            })}
          </div>
          <div class="bi-card-remaining">
            <span class="fh-caption">RESTANTE</span>
            <span style={{ color: remaining >= 0 ? 'var(--success)' : 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 'var(--caption)' }}>
              {formatCLP(remaining)}
            </span>
          </div>
        </>
      ) : (
        <span class="fh-empty" style={{ fontSize: 'var(--caption)', marginTop: 'var(--space-sm)' }}>[SIN PRESUPUESTO]</span>
      )}
    </div>
  );
}

// ─── Budget Panel (single type detail view) ───
function BudgetPanel({ data, periodLabel, budgetType, isReadOnly }: { data: BudgetData; periodLabel: string; budgetType: BudgetType; isReadOnly?: boolean }) {
  const { budgetAmount, totalSpent, expenses, dailySpending, categoryTotals, productTotals, budgetWeekId, categories } = data;
  const remaining = budgetAmount - totalSpent;
  const pct = budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;
  const overflow = totalSpent > budgetAmount;
  const maxDaily = Math.max(...Object.values(dailySpending), 1);
  const budgetLabel = budgetType === "aseo" ? "ASEO" : "COMIDA";
  const periodTypeLabel = budgetType === "aseo" ? "MES ACTUAL" : "SEMANA ACTUAL";
  const noPeriodLabel = budgetType === "aseo" ? "ESTE MES" : "ESTA SEMANA";
  const typeParam = budgetType === "aseo" ? "?type=aseo" : "";

  return (
    <div class="fh-dashboard">
      {/* Budget hero */}
      <div class="fh-week-header">
        <span class="fh-label">{periodTypeLabel} · {budgetLabel}</span>
        <span class="fh-label">{periodLabel}</span>
      </div>

      {budgetAmount > 0 ? (
        <div class="fh-budget-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">GASTADO</span>
              <span
                class="fh-hero-value"
                style={{ color: overflow ? "var(--accent)" : "var(--text-display)" }}
              >
                {formatCLP(totalSpent)}
              </span>
            </div>
            <span class="fh-budget-of">DE {formatCLP(budgetAmount)}</span>
          </div>
          <div class="fh-bar-track">
            {Array.from({ length: 20 }, (_, i) => {
              const segPct = ((i + 1) / 20) * 100;
              const filled = segPct <= pct;
              const color = overflow ? "var(--accent)" : pct > 75 ? "var(--warning)" : "var(--text-display)";
              return (
                <div
                  class={`fh-bar-seg ${filled ? "fh-bar-seg-on" : ""}`}
                  style={filled ? { background: color } : undefined}
                />
              );
            })}
          </div>
          <div class="fh-remaining-row">
            <span class="fh-label">RESTANTE</span>
            <span
              class="fh-remaining-val"
              style={{ color: remaining >= 0 ? "var(--success)" : "var(--accent)" }}
            >
              {formatCLP(remaining)}
            </span>
          </div>
        </div>
      ) : (
        <div class="fh-no-budget">
          <span class="fh-empty">[SIN PRESUPUESTO DE {budgetLabel} {noPeriodLabel}]</span>
          <a href={`/finanzas/presupuesto${typeParam}`} class="fh-link">ESTABLECER PRESUPUESTO →</a>
        </div>
      )}

      {/* Charts */}
      {(categoryTotals.length > 0 || budgetAmount > 0) && (
        <div class="fh-charts-grid">
          {budgetAmount > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">GASTO DIARIO</span>
              <div class="fh-daily-chart">
                {Object.entries(dailySpending).map(([day, amount]) => (
                  <div class="fh-daily-col" key={day}>
                    {amount > 0 && (
                      <span class="fh-daily-val">{formatCLP(amount)}</span>
                    )}
                    <div class="fh-daily-track">
                      <div
                        class="fh-daily-fill"
                        style={{ height: `${(amount / maxDaily) * 100}%` }}
                      />
                    </div>
                    <span class="fh-daily-day">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {categoryTotals.length > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">POR CATEGORÍA</span>
              <PieChart data={categoryTotals} />
            </div>
          )}

          {productTotals.length > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">TOP PRODUCTOS</span>
              <PieChart data={productTotals} />
            </div>
          )}
        </div>
      )}

      {/* Expense form */}
      {!isReadOnly && (
        <div class="fh-section">
          <span class="fh-label">REGISTRAR GASTO</span>
          <ExpenseForm
            budgetWeekId={budgetWeekId}
            categories={categories}
            onSuccess={() => {
              setTimeout(() => { window.location.reload(); }, 600);
            }}
          />
        </div>
      )}

      {/* Budget link */}
      {!isReadOnly && (
        <a href={`/finanzas/presupuesto${typeParam}`} class="fh-action-btn">
          <span class="fh-action-label">
            {budgetAmount > 0 ? `EDITAR PRESUPUESTO ${budgetLabel}` : `ESTABLECER PRESUPUESTO ${budgetLabel}`}
          </span>
          <span class="fh-action-arrow">→</span>
        </a>
      )}
    </div>
  );
}

// ─── Expense List ───
function ExpenseList({ expenses }: { expenses: Expense[] }) {
  return (
    <div class="fh-expense-list">
      {expenses.map((exp) => {
        const date = new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-CL", {
          weekday: "short",
          day: "2-digit",
        });
        const hasItems = exp.items && exp.items.length > 0;
        const typeTag = exp.budgetType === "aseo" ? "ASEO" : "COMIDA";
        return (
          <div class="fh-expense-row" key={exp.id}>
            <div class="fh-expense-info">
              <span class="fh-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <MiniAvatar url={exp.user_avatar} name={exp.user_name} />
                {exp.user_name} · {date} · {exp.category}
                {exp.budgetType && (
                  <span class={`bi-type-tag bi-type-${exp.budgetType}`}>{typeTag}</span>
                )}
              </span>
              {hasItems ? (
                <div class="fh-expense-items">
                  {exp.items!.map((it, i) => (
                    <div class="fh-expense-item" key={i}>
                      <span class="fh-expense-item-name">
                        {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}
                      </span>
                      <span class="fh-expense-item-price">
                        {formatCLP(it.quantity * it.unit_price)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span class="fh-expense-desc">{exp.description}</span>
              )}
            </div>
            <div class="fh-expense-total">
              <span class="fh-expense-amount">-{formatCLP(exp.amount)}</span>
              {hasItems && exp.items!.length > 1 && (
                <span class="fh-expense-total-label">TOTAL</span>
              )}
            </div>
          </div>
        );
      })}
      {expenses.length === 0 && (
        <p class="fh-empty" style={{ padding: "var(--space-xl) 0", textAlign: "center" }}>
          [SIN GASTOS REGISTRADOS]
        </p>
      )}
    </div>
  );
}

// ─── Filterable Expense List (TODOS / COMIDA / ASEO) ───
type ExpenseFilter = "todos" | "comida" | "aseo";

function FilterableExpenseList({ expenses, viewFilter = "todos" }: { expenses: Expense[]; viewFilter?: ExpenseFilter }) {
  const [filter, setFilter] = useState<ExpenseFilter>(viewFilter);

  // Sync filter when the parent view changes
  const [prevViewFilter, setPrevViewFilter] = useState(viewFilter);
  if (viewFilter !== prevViewFilter) {
    setPrevViewFilter(viewFilter);
    setFilter(viewFilter);
  }

  const filtered = filter === "todos"
    ? expenses
    : expenses.filter(e => e.budgetType === filter);

  const counts = {
    todos: expenses.length,
    comida: expenses.filter(e => e.budgetType === "comida").length,
    aseo: expenses.filter(e => e.budgetType === "aseo").length,
  };

  return (
    <div class="fh-section">
      <div class="fh-section-header">
        <span class="fh-label">GASTOS DEL PERÍODO</span>
        <span class="fh-caption">{filtered.length} REGISTROS</span>
      </div>
      <div class="bi-filter-tabs">
        <button
          class={`bi-filter-tab ${filter === "todos" ? "bi-filter-tab-active" : ""}`}
          onClick={() => setFilter("todos")}
        >
          TODOS <span class="bi-filter-count">{counts.todos}</span>
        </button>
        <button
          class={`bi-filter-tab ${filter === "comida" ? "bi-filter-tab-active" : ""}`}
          onClick={() => setFilter("comida")}
        >
          COMIDA <span class="bi-filter-count">{counts.comida}</span>
        </button>
        <button
          class={`bi-filter-tab ${filter === "aseo" ? "bi-filter-tab-active" : ""}`}
          onClick={() => setFilter("aseo")}
        >
          ASEO <span class="bi-filter-count">{counts.aseo}</span>
        </button>
      </div>
      <ExpenseList expenses={filtered} />
    </div>
  );
}

// ─── Expense Form ───
function ExpenseForm({
  budgetWeekId,
  categories,
  onSuccess,
}: {
  budgetWeekId?: string;
  categories: string[];
  onSuccess: () => void;
}) {
  const [items, setItems] = useState<ExpenseItem[]>([
    { id: generateId(), name: "", quantity: 1, unit_price: 0 },
  ]);
  const [category, setCategory] = useState(categories[0]);
  const [expenseDate, setExpenseDate] = useState(formatDateISO(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: generateId(), name: "", quantity: 1, unit_price: 0 },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const updateItem = useCallback(
    (id: string, field: keyof ExpenseItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const validItems = items.filter((i) => i.name.trim() && i.unit_price > 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con nombre y precio");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/expenses/create-with-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          expense_date: expenseDate,
          budget_week_id: budgetWeekId || null,
          items: validItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setSuccess(true);
      setTimeout(onSuccess, 600);
    } catch (e: any) {
      setError(e.message || "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div class="ef-success">
        <span class="ef-success-icon">✓</span>
        <span class="ef-success-text">GASTO REGISTRADO</span>
        <span class="ef-success-total">{formatCLP(total)}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} class="ef-form">
      <div class="ef-section">
        <label class="ef-label">CATEGORÍA</label>
        <div class="ef-tags">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              class={`ef-tag ${category === cat ? "ef-tag-active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div class="ef-section">
        <label class="ef-label">FECHA</label>
        <input
          type="date"
          class="ef-input"
          value={expenseDate}
          onChange={(e) => setExpenseDate((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="ef-section">
        <div class="ef-section-header ef-products-header">
          <label class="ef-section-title">PRODUCTOS</label>
          <span class="ef-count">{items.length}</span>
        </div>
        <div class="ef-items">
          {items.map((item) => (
            <div class="ef-item" key={item.id}>
              <div class="ef-item-row">
                <div class="ef-item-name">
                  <input
                    type="text"
                    class="ef-input"
                    placeholder="Nombre del producto"
                    value={item.name}
                    onInput={(e) =>
                      updateItem(item.id, "name", (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div class="ef-item-qty">
                  <input
                    type="number"
                    class="ef-input ef-input-number"
                    placeholder="Cant"
                    min="0.1"
                    step="0.1"
                    value={item.quantity || ""}
                    onInput={(e) =>
                      updateItem(
                        item.id,
                        "quantity",
                        parseFloat((e.target as HTMLInputElement).value) || 0
                      )
                    }
                  />
                </div>
                <div class="ef-item-price">
                  <input
                    type="number"
                    class="ef-input ef-input-number"
                    placeholder="Precio"
                    min="0"
                    step="1"
                    value={item.unit_price || ""}
                    onInput={(e) =>
                      updateItem(
                        item.id,
                        "unit_price",
                        parseFloat((e.target as HTMLInputElement).value) || 0
                      )
                    }
                  />
                </div>
                <div class="ef-item-total">
                  {item.quantity * item.unit_price > 0
                    ? formatCLP(item.quantity * item.unit_price)
                    : "—"}
                </div>
                <button
                  type="button"
                  class="ef-item-remove"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" class="ef-add-btn" onClick={addItem}>
          + AGREGAR PRODUCTO
        </button>
      </div>

      <div class="ef-total-section">
        <span class="ef-label">TOTAL</span>
        <span class="ef-total-value">{formatCLP(total)}</span>
      </div>

      {error && <div class="ef-error">[ERROR: {error}]</div>}

      <button
        type="submit"
        class="ef-submit"
        disabled={submitting || validItems.length === 0}
      >
        {submitting ? "REGISTRANDO..." : "REGISTRAR GASTO"}
      </button>
    </form>
  );
}
