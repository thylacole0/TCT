/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";

// ─── Types ───
interface MealType {
  id: string;
  name: string;
  sort_order: number;
}

interface MealPlan {
  id: string;
  meal_date: string;
  meal_type_id: string;
  description: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  user_name?: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  budgetWeekId?: string;
  budgetAmount: number;
  totalSpent: number;
  weekLabel: string;
  mealTypes: MealType[];
  todaysMeals: Record<string, string>;
  expenses: Expense[];
  categories: string[];
  dailySpending: Record<string, number>;
  categoryTotals: Array<[string, number]>;
  productTotals: Array<[string, number]>;
}

type ActivePanel = "finanzas" | "comidas";

// ─── Helpers ───
const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
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
            <span class="fh-pie-legend-val">{formatCLP(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function FinanzasHub(props: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>("finanzas");
  const [todaysMeals, setTodaysMeals] = useState<Record<string, string>>(props.todaysMeals);

  const switchPanel = (panel: ActivePanel) => {
    setActivePanel(panel);
  };

  const handleTodayMealChange = (typeName: string, description: string | null) => {
    setTodaysMeals((prev) => {
      const next = { ...prev };
      if (description) {
        next[typeName] = description;
      } else {
        delete next[typeName];
      }
      return next;
    });
  };

  return (
    <div class="fh-root">
      {/* Tab bar */}
      <div class="fh-tabs">
        <button
          class={`fh-tab ${activePanel === "finanzas" ? "fh-tab-active" : ""}`}
          onClick={() => switchPanel("finanzas")}
        >
          FINANZAS
        </button>
        <button
          class={`fh-tab ${activePanel === "comidas" ? "fh-tab-active" : ""}`}
          onClick={() => switchPanel("comidas")}
        >
          COMIDAS
        </button>
      </div>

      {/* Panels */}
      <div class="fh-panel-wrapper">
        <div
          class="fh-panel"
          style={{ display: activePanel === "finanzas" ? "block" : "none" }}
        >
          <FinanzasPanel {...props} />
        </div>
        <div
          class="fh-panel"
          style={{ display: activePanel === "comidas" ? "block" : "none" }}
        >
          <ComidasPanel mealTypes={props.mealTypes} todaysMeals={todaysMeals} onTodayMealChange={handleTodayMealChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Finanzas Panel (Side-by-side layout) ───
function FinanzasPanel({
  budgetAmount,
  totalSpent,
  weekLabel,
  expenses,
  dailySpending,
  categoryTotals,
  productTotals,
  budgetWeekId,
  categories,
}: Props) {
  const remaining = budgetAmount - totalSpent;
  const pct = budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;
  const overflow = totalSpent > budgetAmount;
  const maxDaily = Math.max(...Object.values(dailySpending), 1);

  return (
    <div class="fh-dashboard">
      {/* ── Row 1: Budget hero (full width) ── */}
      <div class="fh-week-header">
        <span class="fh-label">SEMANA ACTUAL</span>
        <span class="fh-label">{weekLabel}</span>
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
            <div
              class="fh-bar-fill"
              style={{
                width: `${pct}%`,
                background: overflow ? "var(--accent)" : pct > 75 ? "var(--warning)" : "var(--text-display)",
              }}
            />
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
          <span class="fh-empty">[SIN PRESUPUESTO ESTA SEMANA]</span>
          <a href="/finanzas/presupuesto" class="fh-link">ESTABLECER PRESUPUESTO →</a>
        </div>
      )}

      {/* ── Row 2: Charts side-by-side ── */}
      {(categoryTotals.length > 0 || budgetAmount > 0) && (
        <div class="fh-charts-grid">
          {/* Daily chart */}
          {budgetAmount > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">GASTO DIARIO</span>
              <div class="fh-daily-chart">
                {Object.entries(dailySpending).map(([day, amount]) => (
                  <div class="fh-daily-col" key={day}>
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

          {/* Category pie */}
          {categoryTotals.length > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">POR CATEGORÍA</span>
              <PieChart data={categoryTotals} />
            </div>
          )}

          {/* Product pie */}
          {productTotals.length > 0 && (
            <div class="fh-section fh-chart-card">
              <span class="fh-label">TOP PRODUCTOS</span>
              <PieChart data={productTotals} />
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: Form (left) + Expenses list (right) ── */}
      <div class="fh-split-grid">
        {/* Left: Expense form */}
        <div class="fh-split-col">
          <div class="fh-section">
            <span class="fh-label">REGISTRAR GASTO</span>
            <ExpensePanel
              budgetWeekId={budgetWeekId}
              categories={categories}
              onSuccess={() => {
                setTimeout(() => {
                  window.location.reload();
                }, 600);
              }}
            />
          </div>
        </div>

        {/* Right: Expenses list */}
        <div class="fh-split-col">
          <div class="fh-section">
            <div class="fh-section-header">
              <span class="fh-label">GASTOS DE LA SEMANA</span>
              <span class="fh-caption">{expenses.length} REGISTROS</span>
            </div>
            <div class="fh-expense-list">
              {expenses.map((exp) => {
                const date = new Date(exp.expense_date).toLocaleDateString("es-CL", {
                  weekday: "short",
                  day: "2-digit",
                });
                return (
                  <div class="fh-expense-row" key={exp.id}>
                    <div class="fh-expense-info">
                      <span class="fh-expense-desc">{exp.description}</span>
                      <span class="fh-caption">
                        {exp.user_name} · {date} · {exp.category}
                      </span>
                    </div>
                    <span class="fh-expense-amount">-{formatCLP(exp.amount)}</span>
                  </div>
                );
              })}
              {expenses.length === 0 && (
                <p class="fh-empty" style={{ padding: "var(--space-xl) 0", textAlign: "center" }}>
                  [SIN GASTOS ESTA SEMANA]
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget link */}
      <a href="/finanzas/presupuesto" class="fh-action-btn">
        <span class="fh-action-label">
          {budgetAmount > 0 ? "EDITAR PRESUPUESTO" : "ESTABLECER PRESUPUESTO"}
        </span>
        <span class="fh-action-arrow">→</span>
      </a>
    </div>
  );
}

// ─── Comidas Panel (Today's meals + Planner) ───
function ComidasPanel({ mealTypes, todaysMeals, onTodayMealChange }: { mealTypes: MealType[]; todaysMeals: Record<string, string>; onTodayMealChange: (typeName: string, description: string | null) => void }) {
  return (
    <div class="fh-comidas">
      {/* Today's meals */}
      <div class="fh-section">
        <span class="fh-label">COMIDAS DE HOY</span>
        <div class="fh-meals-list">
          {mealTypes.map((mt) => (
            <div class="fh-meal-row" key={mt.id}>
              <span class="fh-meal-type">{mt.name}</span>
              <span class="fh-meal-desc">{todaysMeals[mt.name] || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Planner */}
      <MealPlannerPanel mealTypes={mealTypes} onTodayMealChange={onTodayMealChange} />
    </div>
  );
}

// ─── Meal Planner Panel ───
function MealPlannerPanel({ mealTypes, onTodayMealChange }: { mealTypes: MealType[]; onTodayMealChange: (typeName: string, description: string | null) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const mondayStr = formatDateISO(monday);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekLabel = `${monday.getDate()} ${MONTHS_ES[monday.getMonth()]} — ${sunday.getDate()} ${MONTHS_ES[sunday.getMonth()]}`;
  const isCurrentWeek = weekOffset === 0;
  const today = formatDateISO(new Date());

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meals/plan?week_start=${mondayStr}`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data);
      }
    } catch (e) {
      console.error("Failed to fetch meals", e);
    } finally {
      setLoading(false);
    }
  }, [mondayStr]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const getMeal = (date: string, typeId: string) =>
    meals.find((m) => m.meal_date === date && m.meal_type_id === typeId);

  const cellKey = (date: string, typeId: string) => `${date}__${typeId}`;

  const handleCellClick = (date: string, typeId: string) => {
    const existing = getMeal(date, typeId);
    setEditingCell(cellKey(date, typeId));
    setEditingValue(existing?.description || "");
  };

  const handleSave = async (date: string, typeId: string) => {
    const val = editingValue.trim();
    setEditingCell(null);
    const typeName = mealTypes.find((mt) => mt.id === typeId)?.name || "";

    if (!val) {
      const existing = getMeal(date, typeId);
      if (existing) {
        setMeals((prev) => prev.filter((m) => m.id !== existing.id));
        if (date === today && typeName) onTodayMealChange(typeName, null);
        try {
          await fetch("/api/meals/plan", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing.id }),
          });
        } catch {
          setMeals((prev) => [...prev, existing]);
          if (date === today && typeName) onTodayMealChange(typeName, existing.description);
        }
      }
      return;
    }

    const existing = getMeal(date, typeId);
    const tempId = `temp-${Date.now()}`;
    const optimistic: MealPlan = {
      id: existing?.id || tempId,
      meal_date: date,
      meal_type_id: typeId,
      description: val,
    };

    setMeals((prev) => {
      const filtered = prev.filter(
        (m) => !(m.meal_date === date && m.meal_type_id === typeId)
      );
      return [...filtered, optimistic];
    });

    if (date === today && typeName) onTodayMealChange(typeName, val);

    try {
      const res = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_date: date, meal_type_id: typeId, description: val }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          setMeals((prev) =>
            prev.map((m) =>
              m.id === tempId || (m.meal_date === date && m.meal_type_id === typeId)
                ? { ...m, id: data.id }
                : m
            )
          );
        }
      }
    } catch {
      if (existing) {
        setMeals((prev) => {
          const filtered = prev.filter(
            (m) => !(m.meal_date === date && m.meal_type_id === typeId)
          );
          return [...filtered, existing];
        });
        if (date === today && typeName) onTodayMealChange(typeName, existing.description);
      } else {
        setMeals((prev) => prev.filter((m) => m.id !== tempId));
        if (date === today && typeName) onTodayMealChange(typeName, null);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent, date: string, typeId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave(date, typeId);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  return (
    <div class="mp-container">
      <div class="mp-nav">
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>
          ←
        </button>
        <div class="mp-nav-center">
          <span class="mp-week-label">{weekLabel}</span>
          {isCurrentWeek && <span class="mp-badge">ACTUAL</span>}
        </div>
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>
          →
        </button>
      </div>

      <div class="mp-grid">
        <div class="mp-header-cell mp-corner" />
        {mealTypes.map((mt) => (
          <div class="mp-header-cell" key={mt.id}>
            {mt.name.toUpperCase()}
          </div>
        ))}

        {weekDays.map((day, dayIdx) => {
          const dateStr = formatDateISO(day);
          const isToday = dateStr === today;
          return (
            <>
              <div
                class={`mp-day-cell ${isToday ? "mp-today" : ""}`}
                key={`day-${dayIdx}`}
              >
                <span class="mp-day-name">{DAYS_ES[dayIdx]}</span>
                <span class="mp-day-num">{day.getDate()}</span>
              </div>
              {mealTypes.map((mt) => {
                const key = cellKey(dateStr, mt.id);
                const meal = getMeal(dateStr, mt.id);
                const isEditing = editingCell === key;

                return (
                  <div
                    class={`mp-cell ${isToday ? "mp-cell-today" : ""} ${meal ? "mp-cell-filled" : ""}`}
                    key={key}
                    onClick={() => !isEditing && handleCellClick(dateStr, mt.id)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        class="mp-cell-input"
                        value={editingValue}
                        onInput={(e) =>
                          setEditingValue((e.target as HTMLInputElement).value)
                        }
                        onBlur={() => handleSave(dateStr, mt.id)}
                        onKeyDown={(e) => handleKeyDown(e, dateStr, mt.id)}
                        autoFocus
                        placeholder="¿Qué comerás?"
                      />
                    ) : (
                      <span class="mp-cell-text">{meal?.description || ""}</span>
                    )}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>

      {loading && <div class="mp-loading">CARGANDO...</div>}
    </div>
  );
}

// ─── Expense Panel ───
function ExpensePanel({
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
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

  const reset = () => {
    setItems([{ id: generateId(), name: "", quantity: 1, unit_price: 0 }]);
    setCategory(categories[0]);
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setSuccess(false);
    setError("");
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
      {/* Category */}
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

      {/* Date */}
      <div class="ef-section">
        <label class="ef-label">FECHA</label>
        <input
          type="date"
          class="ef-input"
          value={expenseDate}
          onChange={(e) => setExpenseDate((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Products */}
      <div class="ef-section">
        <div class="ef-section-header">
          <label class="ef-label">PRODUCTOS</label>
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

      {/* Total */}
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
