/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS } from "../../lib/personalExpenses.js";
import {
  cycleKeyFromDate,
  formatPersonalCycleLabel,
  getPersonalCycleBounds,
  normalizePersonalBillingCycle,
  type BillingCycleDay,
  type PersonalBillingCycle,
} from "../../lib/dates";
import TctIcon from "../icons/TctIcon";
import MerchantLogo from "../expenses/MerchantLogo";
import SavingsIsland from "./SavingsIsland";
import WeeklyHeatmap from "../expenses/WeeklyHeatmap";
import WeekCategoryGrid from "../expenses/WeekCategoryGrid";

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

interface InstallmentEntry {
  id: string;
  merchant: string;
  description: string | null;
  category: string;
  total_amount: number;
  monthly_amount: number;
  base_monthly_amount?: number;
  current_installment: number;
  total_installments: number;
  start_month: string;
}

interface ByCategoryResponse {
  categories: CategoryGroup[];
  total_spent: number;
  transaction_total?: number;
  installment_total?: number;
  from: string;
  to: string;
  cycle_key?: string;
  billing_start_day?: number;
  billing_end_day?: BillingCycleDay;
  billing_cycle?: PersonalBillingCycle;
  installments?: InstallmentEntry[];
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

const DEFAULT_BILLING_CYCLE: PersonalBillingCycle = { start_day: 1, end_day: "last" };

function cycleDateFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 15);
}

function currentCycleDate(cycle: PersonalBillingCycle = DEFAULT_BILLING_CYCLE) {
  return cycleDateFromKey(cycleKeyFromDate(new Date(), cycle));
}

function cycleDayLabel(day: BillingCycleDay) {
  return day === "last" ? "ÚLTIMO DÍA" : `DÍA ${day}`;
}

function cycleDayInputValue(day: BillingCycleDay) {
  return day === "last" ? "last" : String(day);
}

function parseCycleDayInput(value: string): BillingCycleDay | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "last" || trimmed === "ultimo" || trimmed === "último") return "last";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const day = Math.round(n);
  return day >= 1 && day <= 31 ? day : null;
}

function cycleConfigLabel(cycle: PersonalBillingCycle) {
  return `${cycleDayLabel(cycle.start_day)} → ${cycleDayLabel(cycle.end_day)}`;
}

function installmentPreview(total: number, qty: number) {
  if (total <= 0 || qty <= 0) return null;
  const base = Math.floor(total / qty);
  const last = base + (total - base * qty);
  return { base, last };
}

function sameCycle(a: PersonalBillingCycle, b: PersonalBillingCycle) {
  return a.start_day === b.start_day && a.end_day === b.end_day;
}

function txToInstallmentDefaults(t: PersonalTransaction) {
  return {
    merchant: transactionTitle(t),
    amount: String(Math.round(Number(t.amount) || 0)),
    qty: "3",
    category: t.category || "Otros",
    startMonth: String(t.expense_date || "").slice(0, 7) || monthKey(new Date()),
  };
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
  const [billingCycle, setBillingCycle] = useState<PersonalBillingCycle>(DEFAULT_BILLING_CYCLE);
  const [currentMonth, setCurrentMonth] = useState(() => currentCycleDate(DEFAULT_BILLING_CYCLE));
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Supermercado");
  const [editingPlan, setEditingPlan] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [cycleStartInput, setCycleStartInput] = useState(cycleDayInputValue(DEFAULT_BILLING_CYCLE.start_day));
  const [cycleEndInput, setCycleEndInput] = useState(cycleDayInputValue(DEFAULT_BILLING_CYCLE.end_day));
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((category: string) => [category, ""]))
  );
  const [savingPlan, setSavingPlan] = useState(false);
  const [reclassifyTarget, setReclassifyTarget] = useState<PersonalTransaction | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [activeTab, setActiveTab] = useState<"gastos" | "ahorros">("gastos");
  const [summaryView, setSummaryView] = useState<"heatmap" | "crossgrid">("heatmap");
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; kind: "expense" | "installment" } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMerchant, setAddMerchant] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState("Otros");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [installments, setInstallments] = useState<InstallmentEntry[]>([]);
  // Installment form
  const [showInstModal, setShowInstModal] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentEntry | null>(null);
  const [convertExpense, setConvertExpense] = useState<PersonalTransaction | null>(null);
  const [instMerchant, setInstMerchant] = useState("");
  const [instAmount, setInstAmount] = useState("");
  const [instQty, setInstQty] = useState("3");
  const [instCategory, setInstCategory] = useState("Otros");
  const [instStartMonth, setInstStartMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [savingInst, setSavingInst] = useState(false);

  const fetchData = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    const cycleKey = monthKey(date);
    try {
      const res = await fetch(`/api/personal-expenses/by-category?month=${cycleKey}`);
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json: ByCategoryResponse = await res.json();
      const nextCycle = normalizePersonalBillingCycle(json.billing_cycle, json.billing_start_day);
      if (!sameCycle(nextCycle, billingCycle)) {
        setBillingCycle(nextCycle);
        setCycleStartInput(cycleDayInputValue(nextCycle.start_day));
        setCycleEndInput(cycleDayInputValue(nextCycle.end_day));
      }
      const categories = CATEGORIES.map((category: string) =>
        json.categories.find((g) => g.category === category) || {
          category,
          total: 0,
          count: 0,
          transactions: [],
        }
      );
      setData({ ...json, categories });
      setInstallments(json.installments || []);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [billingCycle]);

  const fetchMonthlyPlan = useCallback(async (date: Date) => {
    const month = monthKey(date);
    const local = readLocalPlan(month);
    setPlanLoading(true);
    setPlanError(null);

    try {
      const res = await fetch(`/api/personal-expenses/monthly-plan?month=${month}`);
      if (!res.ok) {
        setPlan(local);
        setPlanError("Tus presupuestos están guardados en este dispositivo y se sincronizarán automáticamente.");
        return;
      }
      const json = await res.json();
      const nextPlan = normalizePlan(json, month, local);
      setPlan(nextPlan);
      if (!nextPlan.storage_available) {
        setPlanError("Tus presupuestos están guardados en este dispositivo y se sincronizarán automáticamente.");
      }
    } catch {
      setPlan(local);
      setPlanError("Sin conexión: tus presupuestos quedaron guardados en este dispositivo.");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth);
    fetchMonthlyPlan(currentMonth);
  }, [currentMonth, fetchData, fetchMonthlyPlan]);

  // Close modals with Escape
  useEffect(() => {
    if (!editingPlan && !reclassifyTarget && !deleteConfirm && !showAddModal && !showInstModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingPlan(false);
        setReclassifyTarget(null);
        setDeleteConfirm(null);
        setShowAddModal(false);
        setShowInstModal(false);
        setEditingInstallment(null);
        setConvertExpense(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingPlan, reclassifyTarget, deleteConfirm, showAddModal, showInstModal]);

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
    setCycleStartInput(cycleDayInputValue(billingCycle.start_day));
    setCycleEndInput(cycleDayInputValue(billingCycle.end_day));
    setBudgetInputs(Object.fromEntries(CATEGORIES.map((category: string) => [
      category,
      plan.category_budgets[category] > 0 ? String(plan.category_budgets[category]) : "",
    ])));
    setEditingPlan(true);
  };

  const handlePlanSave = async () => {
    const month = monthKey(currentMonth);
    const startDay = parseCycleDayInput(cycleStartInput);
    const endDay = parseCycleDayInput(cycleEndInput);

    if (!startDay || !endDay) {
      setPlanError("El período debe usar días 1-31 o último día.");
      return;
    }

    const nextCycle = normalizePersonalBillingCycle({ start_day: startDay, end_day: endDay });
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
      const [planRes, cycleRes] = await Promise.all([
        fetch("/api/personal-expenses/monthly-plan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month,
            monthly_income: nextPlan.monthly_income,
            category_budgets: nextPlan.category_budgets,
          }),
        }),
        fetch("/api/profile/billing-start-day", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billing_cycle: nextCycle }),
        }),
      ]);

      if (cycleRes.ok) {
        const json = await cycleRes.json();
        const savedCycle = normalizePersonalBillingCycle(json.billing_cycle, json.billing_start_day);
        setBillingCycle(savedCycle);
        setCycleStartInput(cycleDayInputValue(savedCycle.start_day));
        setCycleEndInput(cycleDayInputValue(savedCycle.end_day));
      } else {
        const json = await cycleRes.json().catch(() => null);
        setPlanError(json?.error || "No se pudo guardar el período personal.");
        return;
      }

      if (planRes.ok) {
        const json = await planRes.json();
        const savedPlan = normalizePlan(json, month, nextPlan);
        setPlan(savedPlan);
        writeLocalPlan(month, savedPlan);
      } else {
        nextPlan.storage_available = false;
        setPlan(nextPlan);
        setPlanError("Período guardado. Presupuesto guardado en este dispositivo.");
      }

      setEditingPlan(false);
      await fetchData(currentMonth);
    } catch {
      nextPlan.storage_available = false;
      setPlan(nextPlan);
      setPlanError("Guardado local: se sincronizará cuando vuelva la conexión.");
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id, kind } = deleteConfirm;
    setDeleting(true);
    try {
      if (kind === "installment") {
        const res = await fetch("/api/personal-expenses/installments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          setReclassifyError(json?.error || `Error ${res.status}`);
          setDeleteConfirm(null);
          setDeleting(false);
          return;
        }
      } else {
        const res = await fetch("/api/personal-expenses/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          setReclassifyError(json?.error || `Error ${res.status}`);
          setDeleteConfirm(null);
          setDeleting(false);
          return;
        }
      }
      setDeleteConfirm(null);
      setReclassifyError(null);
      await fetchData(currentMonth);
    } catch {
      setReclassifyError("No se pudo eliminar");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddExpense = async () => {
    if (!addMerchant.trim() || !addAmount.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/personal-expenses/add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: addMerchant.trim(),
          amount: addAmount.replace(/[^0-9]/g, ""),
          category: addCategory,
          expense_date: addDate,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setReclassifyError(json?.error || `Error ${res.status}`);
        return;
      }
      setShowAddModal(false);
      setAddMerchant("");
      setAddAmount("");
      setAddCategory("Otros");
      setAddDate(new Date().toISOString().slice(0, 10));
      setReclassifyError(null);
      await fetchData(currentMonth);
    } catch {
      setReclassifyError("No se pudo agregar el gasto");
    } finally {
      setAdding(false);
    }
  };

  const openAddExpense = () => {
    setReclassifyError(null);
    setShowAddModal(true);
  };

  const resetInstallmentForm = () => {
    setEditingInstallment(null);
    setConvertExpense(null);
    setInstMerchant("");
    setInstAmount("");
    setInstQty("3");
    setInstCategory("Otros");
    setInstStartMonth(monthKey(currentMonth));
  };

  const openCreateInstallment = () => {
    resetInstallmentForm();
    setReclassifyError(null);
    setShowInstModal(true);
  };

  const openEditInstallment = (inst: InstallmentEntry) => {
    setConvertExpense(null);
    setEditingInstallment(inst);
    setInstMerchant(inst.merchant || "");
    setInstAmount(String(Math.round(Number(inst.total_amount) || Number(inst.monthly_amount) * Number(inst.total_installments) || 0)));
    setInstQty(String(inst.total_installments || 3));
    setInstCategory(inst.category || "Otros");
    setInstStartMonth(inst.start_month || monthKey(currentMonth));
    setReclassifyError(null);
    setShowInstModal(true);
  };

  const openConvertExpense = (t: PersonalTransaction) => {
    const defaults = txToInstallmentDefaults(t);
    setEditingInstallment(null);
    setConvertExpense(t);
    setInstMerchant(defaults.merchant);
    setInstAmount(defaults.amount);
    setInstQty(defaults.qty);
    setInstCategory(defaults.category);
    setInstStartMonth(defaults.startMonth);
    setReclassifyError(null);
    setShowInstModal(true);
  };

  const closeInstallmentModal = () => {
    setShowInstModal(false);
    resetInstallmentForm();
  };

  const handleAddInstallment = async () => {
    if (!instMerchant.trim() || !instAmount.trim() || !instQty.trim()) return;
    setSavingInst(true);
    try {
      const isEditing = Boolean(editingInstallment);
      const res = await fetch("/api/personal-expenses/installments", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingInstallment?.id,
          source_expense_id: convertExpense?.id,
          merchant: instMerchant.trim(),
          description: instMerchant.trim(),
          total_amount: instAmount.replace(/[^0-9]/g, ""),
          total_installments: parseInt(instQty, 10),
          category: instCategory,
          start_month: instStartMonth,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setReclassifyError(json?.error || `Error ${res.status}`);
        return;
      }
      closeInstallmentModal();
      setReclassifyError(null);
      await fetchData(currentMonth);
    } catch {
      setReclassifyError(editingInstallment ? "No se pudo editar la cuota" : "No se pudo crear la cuota");
    } finally {
      setSavingInst(false);
    }
  };

  const categories = data?.categories || [];
  const monthTotal = data?.total_spent || 0;
  const hasExpenses = categories.some((g) => g.count > 0);

  // ── Derived: heatmap + week breakdown ──
  const categoryTotals: Record<string, number> = {};
  categories.forEach((g) => { categoryTotals[g.category] = g.total; });

  // Build weekly heatmap data from transactions
  const heatmapWeeks: any[][] = [];
  const heatmapLabels: string[] = [];
  const weekBreakdown: { label: string; values: Record<string, number> }[] = [];
  if (data?.from && data?.to) {
    const from = new Date(data.from + "T12:00:00");
    const to = new Date(data.to + "T12:00:00");
    const weekCount = Math.ceil((to.getTime() - from.getTime()) / (7 * 86400000));
    for (let w = 0; w < weekCount; w++) {
      const wStart = new Date(from);
      wStart.setDate(wStart.getDate() + w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      heatmapLabels.push(`S${w + 1}`);
      const weekVals: Record<string, number> = {};
      // Initialize categories
      weekBreakdown.push({ label: `S${w + 1}`, values: weekVals });
    }
  }
  // Default empty heatmap
  if (heatmapWeeks.length === 0) {
    for (let w = 0; w < 5; w++) {
      heatmapWeeks.push(Array(7).fill(null));
      heatmapLabels.push(`S${w + 1}`);
      weekBreakdown.push({ label: `S${w + 1}`, values: {} });
    }
  }
  const income = plan.monthly_income;
  const showIncomeBar = income > 0 && monthTotal > 0;
  const incomePctRaw = income > 0 ? (monthTotal / income) * 100 : 0;
  const totalCategoryBudget = Object.values(plan.category_budgets).reduce((sum, value) => sum + Number(value || 0), 0);
  const budgetSpentPct = totalCategoryBudget > 0 ? (monthTotal / totalCategoryBudget) * 100 : 0;
  const remainingIncome = income > 0 ? income - monthTotal : 0;
  const activeCycleKey = data?.cycle_key || monthKey(currentMonth);
  const activePeriodLabel = data?.from && data?.to
    ? formatPersonalCycleLabel(data.from, data.to)
    : formatPersonalCycleLabel(
      getPersonalCycleBounds(activeCycleKey, billingCycle).from,
      getPersonalCycleBounds(activeCycleKey, billingCycle).to
    );
  const draftStartDay = parseCycleDayInput(cycleStartInput) || billingCycle.start_day;
  const draftEndDay = parseCycleDayInput(cycleEndInput) || billingCycle.end_day;
  const draftCycle = normalizePersonalBillingCycle({ start_day: draftStartDay, end_day: draftEndDay });
  const draftBounds = getPersonalCycleBounds(activeCycleKey, draftCycle);
  const instTotal = parseMoney(instAmount || "");
  const instQtyNum = Math.round(Number(instQty) || 0);
  const instAmounts = installmentPreview(instTotal, instQtyNum);

  return (
    <div class="fh-root fp-root">
      {/* Tab bar */}
      <div class="fh-tabs fp-tabs">
        <button
          class={`fh-tab ${activeTab === "gastos" ? "fh-tab-active" : ""}`}
          aria-pressed={activeTab === "gastos"}
          onClick={() => setActiveTab("gastos")}
        >
          GASTOS
        </button>
        <button
          class={`fh-tab ${activeTab === "ahorros" ? "fh-tab-active" : ""}`}
          aria-pressed={activeTab === "ahorros"}
          onClick={() => setActiveTab("ahorros")}
        >
          AHORROS
        </button>
      </div>

      {activeTab === "ahorros" ? (
        <SavingsIsland />
      ) : (
      <>
      <div class="fp-top-stack">
        <div class="fp-title-row">
          <span class="fh-label">FINANZAS PERSONALES</span>
        </div>

        <div class="fp-month-nav" aria-label="Seleccionar mes">
          <button class="fp-nav-btn" onClick={goPrevMonth} aria-label="Mes anterior">
            <TctIcon name="chevronLeft" size={18} variant="dots" />
          </button>
          <button
            class="fp-month-label-btn"
            onClick={() => {
              const input = document.getElementById("fp-month-picker") as HTMLInputElement | null;
              input?.showPicker?.();
            }}
            aria-label="Seleccionar mes directamente"
          >
            {monthName(cycleDateFromKey(activeCycleKey))}
            <span class="fp-cycle-badge">{activePeriodLabel}</span>
            <span class="fp-cycle-subtle">{cycleConfigLabel(billingCycle)}</span>
          </button>
          <input
            id="fp-month-picker"
            type="month"
            class="fp-month-input-hidden"
            value={activeCycleKey}
            onInput={(e) => {
              const val = (e.currentTarget as HTMLInputElement).value;
              if (/^\d{4}-\d{2}$/.test(val)) {
                setCurrentMonth(cycleDateFromKey(val));
              }
            }}
            aria-hidden="true"
          />
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
          {planError && <div class="fp-soft-warning" role="status">{planError}</div>}
        </section>
      </div>

      <div class="fh-dashboard fp-dashboard">
        <div class="fh-budget-hero fp-hero">
          <div class="fh-budget-numbers">
            <div class="fh-hero-num">
              <span class="fh-label">GASTADO EN PERÍODO</span>
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
      {error && !loading && (
        <div class="island-error-banner" role="alert">
          <span>[NO PUDIMOS CARGAR TUS GASTOS]</span>
          <button class="island-retry-btn" onClick={() => fetchData(currentMonth)}>
            REINTENTAR
          </button>
        </div>
      )}

      {data && !loading && !error && (
        <>
          <section class="fh-section fp-summary-section">
            <div class="fp-summary-header">
              <span class="fh-label">RESUMEN</span>
              <div class="fp-summary-tabs">
                <button class={`fp-summary-tab ${summaryView === "heatmap" ? "active" : ""}`} onClick={() => setSummaryView("heatmap")}>MAPA</button>
                <button class={`fp-summary-tab ${summaryView === "crossgrid" ? "active" : ""}`} onClick={() => setSummaryView("crossgrid")}>SEMANAL</button>
              </div>
            </div>
            {summaryView === "crossgrid" ? (
              <WeekCategoryGrid
                weeks={weekBreakdown}
                totals={categoryTotals}
                grandTotal={monthTotal}
              />
            ) : (
              <WeeklyHeatmap weeks={heatmapWeeks} weekLabels={heatmapLabels} />
            )}
          </section>

          <section class="fp-category-section">
            <div class="fp-section-head">
              <span class="fh-label">CATEGORÍAS</span>
              <div class="fp-section-actions">
                <button class="fp-inline-action fp-inline-action-small" onClick={openPlanEditor}>
                  <TctIcon name="edit" size={13} variant="dots" />
                  PRESUPUESTOS
                </button>
                <button class="fp-inline-action fp-inline-action-small" onClick={openAddExpense}>
                  <TctIcon name="dollarSign" size={13} variant="dots" />
                  GASTO
                </button>
                <button class="fp-inline-action fp-inline-action-small" onClick={openCreateInstallment}>
                  <TctIcon name="repeat" size={13} variant="dots" />
                  CUOTA
                </button>
              </div>
            </div>

            {!hasExpenses ? (
              <div class="fh-empty fp-state fp-state-large">[NO HAY GASTOS PERSONALES EN ESTE PERÍODO]</div>
            ) : (
              <div class="fp-merchant-list fp-category-list">
                {categories.map((group) => {
                  const isExpanded = expandedCategory === group.category;
                  const budget = Number(plan.category_budgets[group.category] || 0);
                  const categoryBudgetPct = budget > 0 ? (group.total / budget) * 100 : 0;
                  const spendShare = monthTotal > 0 ? Math.round((group.total / monthTotal) * 100) : 0;
                  const tone = budget > 0 ? budgetTone(categoryBudgetPct) : "neutral";
                  const categoryInstallments = installments.filter((inst) => inst.category === group.category);

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
                            {group.count} {group.count === 1 ? "GASTO" : "GASTOS"} · {spendShare}% DEL PERÍODO
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
                          {group.transactions.length === 0 && categoryInstallments.length === 0 ? (
                            <div class="fp-transaction fp-transaction-empty">
                              <div class="fp-tx-left">
                                <span class="fp-tx-date">SIN MOVIMIENTOS</span>
                                <span class="fp-tx-desc">No hay gastos en esta categoría.</span>
                              </div>
                            </div>
                          ) : (
                            <>
                            {group.transactions.map((t) => (
                              <div class="fp-transaction" key={t.id}>
                                <div class="fp-tx-left">
                                  <MerchantLogo merchant={t.merchant || t.description || ""} size={28} className="fp-tx-logo" />
                                  <div class="fp-tx-content">
                                    <span class="fp-tx-date">
                                    {shortDate(t.expense_date)}
                                    {t.display_time ? ` · ${t.display_time}` : ""}
                                  </span>
                                  <span class="fp-tx-desc">{transactionTitle(t)}</span>
                                  <div class="fp-tx-actions">
                                    <button class="fp-tx-category-btn" onClick={() => { setReclassifyTarget(t); setReclassifyError(null); }}>
                                      <TctIcon name={CATEGORY_ICONS[t.category] || "tag"} size={13} variant="dots" />
                                      {t.category}
                                      <TctIcon name="chevronDown" size={12} variant="dots" />
                                    </button>
                                    <button class="fp-tx-category-btn fp-tx-installment-action" onClick={() => openConvertExpense(t)}>
                                      <TctIcon name="repeat" size={13} variant="dots" />
                                      CUOTAS
                                    </button>
                                  </div>
                                </div>
                              </div>
                                <div class="fp-tx-right">
                                  <button
                                    class="fp-tx-delete-btn"
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: t.id, kind: "expense" }); }}
                                    aria-label="Eliminar gasto"
                                    title="Eliminar"
                                  >
                                    <TctIcon name="trash" size={13} variant="dots" />
                                  </button>
                                  <span class="fp-tx-amount">{formatCLP(t.amount)}</span>
                                </div>
                              </div>
                            ))}
                            {/* Show installments for this category */}
                            {categoryInstallments
                              .map((inst) => (
                                <div class="fp-transaction fp-transaction-installment" key={`inst-${inst.id}`}>
                                  <div class="fp-tx-left">
                                    <span class="fp-tx-date fp-tx-installment-badge">
                                      CUOTA {inst.current_installment}/{inst.total_installments}
                                    </span>
                                    <span class="fp-tx-desc">{inst.merchant}</span>
                                    <span class="fp-tx-installment-label">
                                      TOTAL {formatCLP(inst.total_amount)} · {inst.start_month}
                                    </span>
                                  </div>
                                  <div class="fp-tx-right">
                                    <button
                                      class="fp-tx-delete-btn"
                                      onClick={(e) => { e.stopPropagation(); openEditInstallment(inst); }}
                                      aria-label="Editar cuota"
                                      title="Editar cuota"
                                    >
                                      <TctIcon name="edit" size={13} variant="dots" />
                                    </button>
                                    <button
                                      class="fp-tx-delete-btn"
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: inst.id, kind: "installment" }); setReclassifyError(null); }}
                                      aria-label="Eliminar cuota"
                                      title="Eliminar cuota"
                                    >
                                      <TctIcon name="trash" size={13} variant="dots" />
                                    </button>
                                    <span class="fp-tx-amount fp-tx-installment-amount">{formatCLP(inst.monthly_amount)}</span>
                                  </div>
                                </div>
                              ))}
                              </>
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
                <span class="fh-label">SUELDO · PRESUPUESTOS · PERÍODO</span>
                <h2>{monthName(cycleDateFromKey(activeCycleKey))}</h2>
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
                autoFocus
                onInput={(e) => setIncomeInput((e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <div class="fp-cycle-editor">
              <div class="fp-cycle-editor-head">
                <span class="fh-label">PERÍODO PERSONAL</span>
                <span>[PERÍODO: {formatPersonalCycleLabel(draftBounds.from, draftBounds.to)}]</span>
              </div>
              <div class="fp-cycle-presets" aria-label="Atajos de período">
                <button type="button" class="fp-chip-btn" onClick={() => { setCycleStartInput("1"); setCycleEndInput("last"); }}>
                  1 → ÚLTIMO
                </button>
                <button type="button" class="fp-chip-btn" onClick={() => { setCycleStartInput("20"); setCycleEndInput("19"); }}>
                  20 → 19
                </button>
                <button type="button" class="fp-chip-btn" onClick={() => { setCycleStartInput("21"); setCycleEndInput("20"); }}>
                  21 → 20
                </button>
              </div>
              <div class="fp-cycle-fields">
                <label class="fp-money-field">
                  <span>Inicio</span>
                  <select value={cycleStartInput} onChange={(e) => setCycleStartInput((e.currentTarget as HTMLSelectElement).value)}>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => <option value={day} key={day}>Día {day}</option>)}
                    <option value="last">Último día</option>
                  </select>
                </label>
                <label class="fp-money-field">
                  <span>Cierre</span>
                  <select value={cycleEndInput} onChange={(e) => setCycleEndInput((e.currentTarget as HTMLSelectElement).value)}>
                    {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => <option value={day} key={day}>Día {day}</option>)}
                    <option value="last">Último día</option>
                  </select>
                </label>
              </div>
            </div>

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

            {planError && <div class="fp-modal-error" role="alert">{planError}</div>}

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

            {reclassifyError && <div class="fp-modal-error" role="alert">{reclassifyError}</div>}
            {savingCategory && <div class="fp-modal-total">Guardando categoría...</div>}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div class="fp-modal" role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
          <button class="fp-modal-backdrop" aria-label="Cerrar" onClick={() => { if (!deleting) setDeleteConfirm(null); }} />
          <div class="fp-modal-sheet fp-modal-sheet-compact">
            <div class="fp-modal-head">
              <div>
                <span class="fh-label">{deleteConfirm?.kind === "installment" ? "ELIMINAR CUOTA" : "ELIMINAR GASTO"}</span>
                <h2>{deleteConfirm?.kind === "installment" ? "¿Eliminar esta cuota?" : "¿Eliminar este gasto?"}</h2>
              </div>
            </div>
            <div class="fp-modal-body">
              <p>{deleteConfirm?.kind === "installment"
                ? "Esta acción no se puede deshacer. La cuota dejará de aparecer en tus finanzas."
                : "Esta acción no se puede deshacer."}</p>
            </div>
            {reclassifyError && <div class="fp-modal-error" role="alert">{reclassifyError}</div>}
            <div class="fp-modal-actions">
              <button
                class="fp-secondary-btn"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                class="fp-danger-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add expense modal */}
      {showAddModal && (
        <div class="fp-modal" role="dialog" aria-modal="true" aria-label="Agregar gasto">
          <button class="fp-modal-backdrop" aria-label="Cerrar" onClick={() => setShowAddModal(false)} />
          <div class="fp-modal-sheet fp-modal-sheet-compact">
            <div class="fp-modal-head">
              <div>
                <span class="fh-label">AGREGAR GASTO</span>
                <h2>Nuevo gasto manual</h2>
              </div>
              <button class="fp-icon-btn" onClick={() => setShowAddModal(false)} aria-label="Cerrar">
                <TctIcon name="x" size={18} variant="dots" />
              </button>
            </div>

            <label class="fp-money-field">
              <span>Comercio</span>
              <input
                class="fp-add-input"
                value={addMerchant}
                onInput={(e) => setAddMerchant((e.currentTarget as HTMLInputElement).value)}
                placeholder="Ej: Uber Eats"
                autoFocus
              />
            </label>

            <label class="fp-money-field">
              <span>Monto ($)</span>
              <input
                class="fp-add-input"
                inputMode="numeric"
                value={addAmount}
                onInput={(e) => setAddAmount((e.currentTarget as HTMLInputElement).value)}
                placeholder="8490"
              />
            </label>

            <label class="fp-money-field">
              <span>Fecha</span>
              <input
                class="fp-add-input"
                type="date"
                value={addDate}
                onInput={(e) => setAddDate((e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <div class="fp-category-options" style="margin-top: var(--space-sm)">
              {CATEGORIES.map((cat: string) => (
                <button
                  class={`fp-category-option ${addCategory === cat ? "active" : ""}`}
                  key={cat}
                  onClick={() => setAddCategory(cat)}
                  disabled={adding}
                >
                  <span class="fp-category-option-left">
                    <span class="fp-category-dot" style={{ background: categoryColor(cat) }} />
                    {cat}
                  </span>
                  {addCategory === cat && <TctIcon name="check" size={16} variant="dots" />}
                </button>
              ))}
            </div>

            {reclassifyError && <div class="fp-modal-error" role="alert">{reclassifyError}</div>}

            <div class="fp-modal-actions">
              <button class="fp-secondary-btn" onClick={() => setShowAddModal(false)} disabled={adding}>
                Cancelar
              </button>
              <button
                class="fp-primary-btn"
                onClick={handleAddExpense}
                disabled={adding || !addMerchant.trim() || !addAmount.trim()}
              >
                {adding ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Installment modal */}
      {showInstModal && (
        <div class="fp-modal" role="dialog" aria-modal="true" aria-label="Cuota personal">
          <button class="fp-modal-backdrop" aria-label="Cerrar" onClick={closeInstallmentModal} />
          <div class="fp-modal-sheet fp-modal-sheet-compact">
            <div class="fp-modal-head">
              <div>
                <span class="fh-label">{editingInstallment ? "EDITAR CUOTA" : convertExpense ? "CONVERTIR A CUOTAS" : "AGREGAR CUOTA"}</span>
                <h2>{editingInstallment ? "Editar plan de cuotas" : convertExpense ? "Reemplazar gasto por cuotas" : "Nuevo plan de cuotas"}</h2>
              </div>
              <button class="fp-icon-btn" onClick={closeInstallmentModal} aria-label="Cerrar">
                <TctIcon name="x" size={18} variant="dots" />
              </button>
            </div>

            {convertExpense && (
              <div class="fp-modal-warning" role="status">
                Este gasto ({formatCLP(convertExpense.amount)}) será reemplazado por el plan de cuotas para evitar doble conteo.
              </div>
            )}

            <label class="fp-money-field">
              <span>Comercio</span>
              <input
                class="fp-add-input"
                value={instMerchant}
                onInput={(e) => setInstMerchant((e.currentTarget as HTMLInputElement).value)}
                placeholder="Ej: Falabella"
                autoFocus
              />
            </label>

            <label class="fp-money-field">
              <span>Total ($)</span>
              <input
                class="fp-add-input"
                inputMode="numeric"
                value={instAmount}
                onInput={(e) => setInstAmount((e.currentTarget as HTMLInputElement).value)}
                placeholder="300000"
              />
            </label>

            <label class="fp-money-field">
              <span>Cuotas</span>
              <input
                class="fp-add-input fp-add-input-sm"
                type="number"
                min="2"
                max="120"
                value={instQty}
                onInput={(e) => setInstQty((e.currentTarget as HTMLInputElement).value)}
                placeholder="6"
                style="max-width:80px"
              />
            </label>

            <label class="fp-money-field">
              <span>Mes de inicio</span>
              <input
                class="fp-add-input"
                type="month"
                value={instStartMonth}
                onInput={(e) => setInstStartMonth((e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            {instAmounts && (
              <div class="fp-modal-total" style="margin-bottom:var(--space-sm)">
                {formatCLP(instAmounts.base)} por cuota
                {instAmounts.last !== instAmounts.base ? ` · última ${formatCLP(instAmounts.last)}` : ""}
              </div>
            )}

            <div class="fp-category-options" style="margin-top: var(--space-sm)">
              {CATEGORIES.map((cat: string) => (
                <button
                  class={`fp-category-option ${instCategory === cat ? "active" : ""}`}
                  key={cat}
                  onClick={() => setInstCategory(cat)}
                  disabled={savingInst}
                >
                  <span class="fp-category-option-left">
                    <span class="fp-category-dot" style={{ background: categoryColor(cat) }} />
                    {cat}
                  </span>
                  {instCategory === cat && <TctIcon name="check" size={16} variant="dots" />}
                </button>
              ))}
            </div>

            {reclassifyError && <div class="fp-modal-error" role="alert">{reclassifyError}</div>}

            <div class="fp-modal-actions">
              <button class="fp-secondary-btn" onClick={closeInstallmentModal} disabled={savingInst}>
                Cancelar
              </button>
              <button
                class="fp-primary-btn"
                onClick={handleAddInstallment}
                disabled={savingInst || !instMerchant.trim() || !instAmount.trim() || !instQty.trim()}
              >
                {savingInst
                  ? "Guardando..."
                  : editingInstallment
                    ? "Guardar cambios"
                    : convertExpense
                      ? "Convertir a cuotas"
                      : "Crear cuota"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
