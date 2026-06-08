/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS } from "../../lib/personalExpenses.js";
import TctIcon from "../icons/TctIcon";

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

interface MonthlyPlan {
  month_start: string;
  monthly_income: number;
  category_budgets: Record<string, number>;
  storage_available: boolean;
  warning?: string | null;
}

const LEGACY_INCOME_KEY = "tct_personal_monthly_income";
const LOCAL_PLAN_PREFIX = "tct_personal_monthly_plan";

function defaultBudgets() {
  return Object.fromEntries(CATEGORIES.map((category: string) => [category, 0]));
}

function defaultPlan(monthStart = "") : MonthlyPlan {
  return {
    month_start: monthStart,
    monthly_income: 0,
    category_budgets: defaultBudgets(),
    storage_available: true,
  };
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function shortDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit" }).toUpperCase();
}

function monthName(date: Date) {
  return date.toLocaleDateString("es-CL", { month: "long", year: "numeric" }).toUpperCase();
}

function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthStart(date: Date) {
  return `${monthKey(date)}-01`;
}

function monthBounds(date: Date) {
  const from = monthStart(date);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const to = `${monthKey(date)}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function localPlanKey(month: string) {
  return `${LOCAL_PLAN_PREFIX}_${month}`;
}

function readLocalPlan(month: string): MonthlyPlan {
  const plan = defaultPlan(`${month}-01`);
  if (typeof localStorage === "undefined") return plan;

  try {
    const raw = localStorage.getItem(localPlanKey(month));
    if (raw) {
      const parsed = JSON.parse(raw);
      plan.monthly_income = Number(parsed.monthly_income) || 0;
      plan.category_budgets = { ...plan.category_budgets, ...(parsed.category_budgets || {}) };
    }

    const legacy = Number(localStorage.getItem(LEGACY_INCOME_KEY) || "0");
    if (!plan.monthly_income && legacy > 0) {
      plan.monthly_income = legacy;
    }
  } catch {
    // ignore local fallback failures
  }

  plan.storage_available = false;
  return plan;
}

function writeLocalPlan(month: string, plan: MonthlyPlan) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(localPlanKey(month), JSON.stringify({
      monthly_income: plan.monthly_income,
      category_budgets: plan.category_budgets,
    }));
    if (plan.monthly_income > 0) {
      localStorage.setItem(LEGACY_INCOME_KEY, String(plan.monthly_income));
    }
  } catch {
    // ignore local fallback failures
  }
}

function transactionTitle(t: PersonalTransaction) {
  if (t.merchant && t.description && !t.description.toLowerCase().includes(t.merchant.toLowerCase())) {
    return `${t.merchant} · ${t.description}`;
  }
  return t.merchant || t.description || "Gasto personal";
}

function categoryColor(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Otros;
}

function budgetTone(pct: number): "neutral" | "warning" | "danger" {
  if (pct > 100) return "danger";
  if (pct >= 80) return "warning";
  return "neutral";
}

function ProgressLine({ pct, tone = "neutral" }: { pct: number; tone?: "neutral" | "warning" | "danger" }) {
  const width = Math.min(Math.max(pct, pct > 0 ? 2 : 0), 100);
  return (
    <div class={`fp-progress fp-progress-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(pct, 100))}>
      <div class="fp-progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function normalizePlan(raw: any, month: string, local: MonthlyPlan): MonthlyPlan {
  const apiBudgets = { ...defaultBudgets(), ...(raw?.category_budgets || {}) };
  const apiIncome = Number(raw?.monthly_income) || 0;
  const storageAvailable = raw?.storage_available !== false;

  const allApiBudgetsAreZero = Object.values(apiBudgets).every((value) => Number(value) === 0);
  const hasLocalBudget = Object.values(local.category_budgets).some((value) => Number(value) > 0);

  return {
    month_start: raw?.month_start || `${month}-01`,
    monthly_income: apiIncome > 0 ? apiIncome : local.monthly_income,
    category_budgets: storageAvailable && !(allApiBudgetsAreZero && hasLocalBudget)
      ? apiBudgets
      : { ...apiBudgets, ...local.category_budgets },
    storage_available: storageAvailable,
    warning: raw?.warning || null,
  };
}

export default function FinanzasPersonalesIsland() {
  const [data, setData] = useState<ByCategoryResponse | null>(null);
  const [plan, setPlan] = useState<MonthlyPlan>(() => defaultPlan(monthStart(new Date())));
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Supermercado");
  const [editingPlan, setEditingPlan] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((category: string) => [category, ""]))
  );
  const [savingPlan, setSavingPlan] = useState(false);
  const [reclassifyTarget, setReclassifyTarget] = useState<PersonalTransaction | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

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
      const categories = CATEGORIES.map((category: string) =>
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

  const fetchMonthlyPlan = useCallback(async (date: Date) => {
    const month = monthKey(date);
    const local = readLocalPlan(month);
    setPlanLoading(true);
    setPlanError(null);

    try {
      const res = await fetch(`/api/personal-expenses/monthly-plan?month=${month}`);
      if (!res.ok) {
        setPlan(local);
        setPlanError("Presupuestos usando respaldo local hasta aplicar migración.");
        return;
      }
      const json = await res.json();
      const nextPlan = normalizePlan(json, month, local);
      setPlan(nextPlan);
      if (!nextPlan.storage_available) {
        setPlanError("Presupuestos usando respaldo local hasta aplicar migración.");
      }
    } catch {
      setPlan(local);
      setPlanError("Presupuestos usando respaldo local hasta reconectar.");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth);
    fetchMonthlyPlan(currentMonth);
  }, [currentMonth, fetchData, fetchMonthlyPlan]);

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

  const openPlanEditor = () => {
    setPlanError(null);
    setIncomeInput(plan.monthly_income > 0 ? String(plan.monthly_income) : "");
    setBudgetInputs(Object.fromEntries(CATEGORIES.map((category: string) => [
      category,
      plan.category_budgets[category] > 0 ? String(plan.category_budgets[category]) : "",
    ])));
    setEditingPlan(true);
  };

  const handlePlanSave = async () => {
    const month = monthKey(currentMonth);
    const nextPlan: MonthlyPlan = {
      month_start: `${month}-01`,
      monthly_income: parseMoney(incomeInput),
      category_budgets: Object.fromEntries(CATEGORIES.map((category: string) => [
        category,
        parseMoney(budgetInputs[category] || ""),
      ])),
      storage_available: plan.storage_available,
    };

    setSavingPlan(true);
    setPlanError(null);
    writeLocalPlan(month, nextPlan);

    try {
      const res = await fetch("/api/personal-expenses/monthly-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          monthly_income: nextPlan.monthly_income,
          category_budgets: nextPlan.category_budgets,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const savedPlan = normalizePlan(json, month, nextPlan);
        setPlan(savedPlan);
        writeLocalPlan(month, savedPlan);
        setEditingPlan(false);
      } else {
        nextPlan.storage_available = false;
        setPlan(nextPlan);
        setPlanError("Guardado localmente. Falta aplicar la migración en Supabase para sincronizar.");
        setEditingPlan(false);
      }
    } catch {
      nextPlan.storage_available = false;
      setPlan(nextPlan);
      setPlanError("Guardado localmente. Se sincronizará cuando el API esté disponible.");
      setEditingPlan(false);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleReclassify = async (category: string) => {
    if (!reclassifyTarget) return;
    if (category === reclassifyTarget.category) {
      setReclassifyTarget(null);
      return;
    }

    setSavingCategory(true);
    setReclassifyError(null);
    try {
      const res = await fetch("/api/personal-expenses/reclassify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reclassifyTarget.id, category }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setReclassifyError(json?.error || `Error ${res.status}`);
        return;
      }
      setReclassifyTarget(null);
      await fetchData(currentMonth);
    } catch {
      setReclassifyError("No se pudo cambiar la categoría");
    } finally {
      setSavingCategory(false);
    }
  };

  const categories = data?.categories || [];
  const monthTotal = data?.total_spent || 0;
  const hasExpenses = categories.some((g) => g.count > 0);
  const income = plan.monthly_income;
  const showIncomeBar = income > 0 && monthTotal > 0;
  const incomePctRaw = income > 0 ? (monthTotal / income) * 100 : 0;
  const totalCategoryBudget = Object.values(plan.category_budgets).reduce((sum, value) => sum + Number(value || 0), 0);
  const budgetSpentPct = totalCategoryBudget > 0 ? (monthTotal / totalCategoryBudget) * 100 : 0;
  const remainingIncome = income > 0 ? income - monthTotal : 0;

  return (
    <div class="fh-root fp-root">
      <div class="fp-top-stack">
        <div class="fp-title-row">
          <span class="fh-label">FINANZAS PERSONALES</span>
        </div>

        <div class="fp-month-nav" aria-label="Seleccionar mes">
          <button class="fp-nav-btn" onClick={goPrevMonth} aria-label="Mes anterior">
            <TctIcon name="chevronLeft" size={18} variant="dots" />
          </button>
          <span class="fp-month-label">{monthName(currentMonth)}</span>
          <button class="fp-nav-btn" onClick={goNextMonth} aria-label="Mes siguiente">
            <TctIcon name="chevronRight" size={18} variant="dots" />
          </button>
        </div>

        <section class="fp-income-card dot-grid-subtle" aria-label="Sueldo mensual">
          <div class="fp-income-card-header">
            <span class="dash-card-label">SUELDO MENSUAL</span>
            <button class="fp-inline-action" onClick={openPlanEditor}>
              <TctIcon name="edit" size={14} variant="dots" />
              {income > 0 ? "EDITAR" : "CONFIGURAR"}
            </button>
          </div>
          <span class={`dash-budget-amount ${income <= 0 ? "fp-income-empty" : ""}`}>
            {planLoading ? "[...]" : income > 0 ? formatCLP(income) : "[SUELDO NO CONFIGURADO]"}
          </span>
          {income > 0 && (
            <span class="dash-budget-of fp-income-meta-card">
              Disponible estimado: {formatCLP(Math.max(remainingIncome, 0))}
              {remainingIncome < 0 ? " · sueldo sobrepasado" : ""}
            </span>
          )}
          {planError && <div class="fp-soft-warning">{planError}</div>}
        </section>
      </div>

      <div class="fh-dashboard fp-dashboard">
        <div class="fh-budget-hero fp-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">GASTADO EN EL MES</span>
              <span class="fh-hero-value">{data ? formatCLP(monthTotal) : "—"}</span>
            </div>
            {income > 0 && (
              <div class="fh-hero-num fp-hero-side">
                <span class="fh-label">DEL SUELDO</span>
                <span class="fh-hero-value fp-hero-percent">{incomePctRaw.toFixed(0)}%</span>
              </div>
            )}
          </div>
          {showIncomeBar ? (
            <ProgressLine pct={incomePctRaw} tone={budgetTone(incomePctRaw)} />
          ) : data && monthTotal > 0 ? (
            <ProgressLine pct={12} />
          ) : null}
          {income > 0 && (
            <div class="fp-progress-caption">
              {formatCLP(monthTotal)} de {formatCLP(income)}
            </div>
          )}
          {totalCategoryBudget > 0 && (
            <div class="fp-budget-caption">
              Presupuesto categorías: {formatCLP(monthTotal)} de {formatCLP(totalCategoryBudget)} · {budgetSpentPct.toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {loading && <div class="fh-empty fp-state">[CARGANDO...]</div>}
      {error && <div class="fh-empty fp-state fp-state-error">[{error}]</div>}

      {data && !loading && !error && (
        <>
          <section class="fh-section fp-summary-section">
            <span class="fh-label">RESUMEN POR CATEGORÍA</span>
            {hasExpenses ? (
              <div class="fh-pie-wrap fp-summary-list">
                {categories.filter((g) => g.total > 0).map((group) => (
                  <div class="fh-pie-legend-item" key={group.category}>
                    <span class="fh-pie-dot" style={{ background: categoryColor(group.category) }} />
                    <span class="fh-pie-legend-label">{group.category}</span>
                    <span class="fh-pie-legend-pct">{monthTotal > 0 ? Math.round((group.total / monthTotal) * 100) : 0}%</span>
                    <span class="fh-pie-legend-val">{formatCLP(group.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div class="fh-empty fp-state">[SIN GASTOS]</div>
            )}
          </section>

          <section class="fp-category-section">
            <div class="fp-section-head">
              <span class="fh-label">CATEGORÍAS</span>
              <button class="fp-inline-action fp-inline-action-small" onClick={openPlanEditor}>
                <TctIcon name="edit" size={13} variant="dots" />
                PRESUPUESTOS
              </button>
            </div>

            {!hasExpenses ? (
              <div class="fh-empty fp-state fp-state-large">[NO HAY GASTOS PERSONALES EN ESTE MES]</div>
            ) : (
              <div class="fp-merchant-list fp-category-list">
                {categories.map((group) => {
                  const isExpanded = expandedCategory === group.category;
                  const budget = Number(plan.category_budgets[group.category] || 0);
                  const categoryBudgetPct = budget > 0 ? (group.total / budget) * 100 : 0;
                  const spendShare = monthTotal > 0 ? Math.round((group.total / monthTotal) * 100) : 0;
                  const tone = budget > 0 ? budgetTone(categoryBudgetPct) : "neutral";

                  return (
                    <div class="fp-merchant-group fp-category-card" key={group.category}>
                      <button
                        class="fp-merchant-header fp-category-header"
                        onClick={() => toggleCategory(group.category)}
                        aria-expanded={isExpanded}
                      >
                        <div class="fp-merchant-info fp-category-info">
                          <span class="fp-merchant-name fp-category-title">
                            <span class="fp-category-dot" style={{ background: categoryColor(group.category) }} />
                            {group.category}
                          </span>
                          <span class="fp-merchant-meta">
                            {group.count} {group.count === 1 ? "GASTO" : "GASTOS"} · {spendShare}% DEL GASTO MENSUAL
                          </span>
                        </div>
                        <div class="fp-merchant-right">
                          <span class="fp-merchant-total">{formatCLP(group.total)}</span>
                          <span class="fp-chevron" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            <TctIcon name="chevronDown" size={14} variant="dots" />
                          </span>
                        </div>
                      </button>

                      <div class="fp-category-budget-row">
                        {budget > 0 ? (
                          <>
                            <span>Presupuesto: {formatCLP(budget)} · {categoryBudgetPct.toFixed(0)}% usado</span>
                            {categoryBudgetPct > 100 && <strong>SOBREPASADO</strong>}
                          </>
                        ) : (
                          <button class="fp-budget-empty-btn" onClick={openPlanEditor}>Definir presupuesto</button>
                        )}
                      </div>
                      {budget > 0 && <ProgressLine pct={categoryBudgetPct} tone={tone} />}

                      {isExpanded && (
                        <div class="fp-transactions">
                          {group.transactions.length === 0 ? (
                            <div class="fp-transaction fp-transaction-empty">
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
                                  <span class="fp-tx-desc">{transactionTitle(t)}</span>
                                  <button class="fp-tx-category-btn" onClick={() => { setReclassifyTarget(t); setReclassifyError(null); }}>
                                    <TctIcon name={CATEGORY_ICONS[t.category] || "tag"} size={13} variant="dots" />
                                    {t.category}
                                    <TctIcon name="chevronDown" size={12} variant="dots" />
                                  </button>
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
          </section>
        </>
      )}

      {editingPlan && (
        <div class="fp-modal" role="dialog" aria-modal="true" aria-label="Editar sueldo y presupuestos">
          <button class="fp-modal-backdrop" aria-label="Cerrar" onClick={() => setEditingPlan(false)} />
          <div class="fp-modal-sheet">
            <div class="fp-modal-head">
              <div>
                <span class="fh-label">PRESUPUESTOS</span>
                <h2>Presupuestos — {monthName(currentMonth)}</h2>
              </div>
              <button class="fp-icon-btn" onClick={() => setEditingPlan(false)} aria-label="Cerrar">
                <TctIcon name="x" size={18} variant="dots" />
              </button>
            </div>

            <label class="fp-money-field fp-money-field-featured">
              <span>Sueldo mensual</span>
              <input
                inputMode="numeric"
                value={incomeInput}
                placeholder="1830000"
                onInput={(e) => setIncomeInput((e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <div class="fp-budget-editor-list">
              {CATEGORIES.map((category: string) => (
                <label class="fp-money-field" key={category}>
                  <span>
                    <i style={{ background: categoryColor(category) }} />
                    {category}
                  </span>
                  <input
                    inputMode="numeric"
                    value={budgetInputs[category] || ""}
                    placeholder="0"
                    onInput={(e) => setBudgetInputs({ ...budgetInputs, [category]: (e.currentTarget as HTMLInputElement).value })}
                  />
                </label>
              ))}
            </div>

            <div class="fp-modal-total">
              Total presupuestado: {formatCLP(Object.values(budgetInputs).reduce((sum, value) => sum + parseMoney(String(value || "")), 0))}
              {parseMoney(incomeInput) > 0 && ` de ${formatCLP(parseMoney(incomeInput))}`}
            </div>

            {planError && <div class="fp-modal-error">{planError}</div>}

            <div class="fp-modal-actions">
              <button class="fp-secondary-btn" onClick={() => setEditingPlan(false)} disabled={savingPlan}>Cancelar</button>
              <button class="fp-primary-btn" onClick={handlePlanSave} disabled={savingPlan}>
                {savingPlan ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reclassifyTarget && (
        <div class="fp-modal" role="dialog" aria-modal="true" aria-label="Cambiar categoría">
          <button class="fp-modal-backdrop" aria-label="Cerrar" onClick={() => setReclassifyTarget(null)} />
          <div class="fp-modal-sheet fp-modal-sheet-compact">
            <div class="fp-modal-head">
              <div>
                <span class="fh-label">CAMBIAR CATEGORÍA</span>
                <h2>{transactionTitle(reclassifyTarget)}</h2>
              </div>
              <button class="fp-icon-btn" onClick={() => setReclassifyTarget(null)} aria-label="Cerrar">
                <TctIcon name="x" size={18} variant="dots" />
              </button>
            </div>

            <div class="fp-category-options">
              {CATEGORIES.map((category: string) => {
                const active = category === reclassifyTarget.category;
                return (
                  <button
                    class={`fp-category-option ${active ? "active" : ""}`}
                    key={category}
                    onClick={() => handleReclassify(category)}
                    disabled={savingCategory}
                  >
                    <span class="fp-category-option-left">
                      <span class="fp-category-dot" style={{ background: categoryColor(category) }} />
                      {category}
                    </span>
                    {active && <TctIcon name="check" size={16} variant="dots" />}
                  </button>
                );
              })}
            </div>

            {reclassifyError && <div class="fp-modal-error">{reclassifyError}</div>}
            {savingCategory && <div class="fp-modal-total">Guardando categoría...</div>}
          </div>
        </div>
      )}
    </div>
  );
}
