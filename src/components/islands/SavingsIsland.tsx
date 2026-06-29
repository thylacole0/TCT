/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import TctIcon from "../icons/TctIcon";
import AnnualGoal from "../savings/AnnualGoal";
import AnnualProjection from "../savings/AnnualProjection";
import CumulativeStaircase from "../savings/CumulativeStaircase";

// ── Types ──
interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  start_date: string;
  target_date: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  notes: string | null;
  progress_pct?: number;
}

interface SavingsEntry {
  id: string;
  goal_id: string;
  amount: number;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

// ── Helpers ──
function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}
function pct(n: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((n / total) * 100));
}
function monthsRemaining(current: number, target: number, monthly: number): number | null {
  if (!monthly || monthly <= 0 || current >= target) return null;
  return Math.ceil((target - current) / monthly);
}

const MONTHS_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// ── Sub-components ──

function ProgressBar({ current, target, color }: { current: number; target: number; color: string }) {
  const p = pct(current, target);
  return (
    <div class="savings-progress">
      <div class="savings-progress-track">
        <div class="savings-progress-fill" style={{ width: `${p}%`, background: color }} />
      </div>
      <span class="savings-progress-pct">{p}%</span>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddEntry,
}: {
  goal: SavingsGoal;
  onEdit: (g: SavingsGoal) => void;
  onDelete: (id: string) => void;
  onAddEntry: (g: SavingsGoal) => void;
}) {
  const remaining = monthsRemaining(goal.current_amount, goal.target_amount, goal.monthly_contribution || 0);
  const progress = pct(goal.current_amount, goal.target_amount);
  return (
    <div class="savings-card dot-grid-subtle">
      <div class="savings-card-header">
        <div class="savings-card-title">
          <span class="savings-card-name">
            <span class="savings-card-dot" style={{ background: goal.color }} />
            {goal.name}
          </span>
          <span class="savings-card-eta">
            {remaining !== null ? `${remaining} ${remaining === 1 ? "MES" : "MESES"} RESTANTES` : "SIN RITMO DEFINIDO"}
          </span>
        </div>
        <div class="savings-card-actions">
          <button class="btn-icon" onClick={() => onAddEntry(goal)} title="Agregar aporte"><TctIcon name="plus" size={14} variant="dots" /></button>
          <button class="btn-icon" onClick={() => onEdit(goal)} title="Editar"><TctIcon name="edit" size={14} variant="dots" /></button>
          <button class="btn-icon btn-icon-danger" onClick={() => onDelete(goal.id)} title="Eliminar"><TctIcon name="trash" size={14} variant="dots" /></button>
        </div>
      </div>

      <div class="savings-card-hero">
        <span class="savings-card-hero-value" style={{ color: goal.color }}>{formatCLP(goal.current_amount)}</span>
        <span class="savings-card-hero-meta">{progress}% DE {formatCLP(goal.target_amount)}</span>
      </div>

      <ProgressBar current={goal.current_amount} target={goal.target_amount} color={goal.color} />

      {goal.monthly_contribution ? (
        <div class="savings-card-foot">
          <span class="savings-label">APORTE MENSUAL</span>
          <span class="savings-card-foot-value">{formatCLP(goal.monthly_contribution)}</span>
        </div>
      ) : null}
    </div>
  );
}

// ── Forms ──

function GoalForm({
  goal,
  onSave,
  onCancel,
}: {
  goal?: SavingsGoal | null;
  onSave: (data: Partial<SavingsGoal>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(goal?.name || "");
  const [target, setTarget] = useState(goal?.target_amount?.toString() || "");
  const [monthly, setMonthly] = useState(goal?.monthly_contribution?.toString() || "");
  const [color, setColor] = useState(goal?.color || "#10B981");
  const [notes, setNotes] = useState(goal?.notes || "");
  const [targetDate, setTargetDate] = useState(goal?.target_date || "");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      target_amount: Number(target) || 0,
      monthly_contribution: monthly ? Number(monthly) : null,
      color,
      notes: notes.trim() || null,
      target_date: targetDate || null,
    });
  };

  const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444", "#6B7280"];

  return (
    <div class="savings-modal-overlay" onClick={onCancel}>
      <form class="savings-form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <span class="savings-form-kicker">{goal ? "EDITAR META" : "NUEVA META"}</span>
        <h3 class="savings-form-title">{goal ? "Editar meta de ahorro" : "Nueva meta de ahorro"}</h3>
        <label class="savings-field">
          <span>Nombre</span>
          <input type="text" value={name} onInput={(e: any) => setName(e.target.value)} placeholder="Ej: Fondo de emergencia" required />
        </label>
        <div class="savings-field-row">
          <label class="savings-field">
            <span>Meta ($)</span>
            <input type="number" value={target} onInput={(e: any) => setTarget(e.target.value)} placeholder="1.000.000" min="0" required />
          </label>
          <label class="savings-field">
            <span>Aporte mensual ($)</span>
            <input type="number" value={monthly} onInput={(e: any) => setMonthly(e.target.value)} placeholder="100.000" min="0" />
          </label>
        </div>
        <label class="savings-field">
          <span>Fecha límite (opcional)</span>
          <input type="date" value={targetDate} onInput={(e: any) => setTargetDate(e.target.value)} />
        </label>
        <label class="savings-field">
          <span>Color</span>
          <div class="savings-color-picker">
            {colors.map((c) => (
              <button type="button" key={c} class={`savings-color-swatch ${color === c ? "active" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </label>
        <label class="savings-field">
          <span>Notas</span>
          <textarea value={notes} onInput={(e: any) => setNotes(e.target.value)} rows={2} placeholder="Opcional" />
        </label>
        <div class="savings-form-actions">
          <button type="button" class="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" class="btn-primary">{goal ? "Guardar" : "Crear meta"}</button>
        </div>
      </form>
    </div>
  );
}

interface EntryDraft {
  id?: string;          // present when editing
  goalId: string;
  amount: number;
  notes: string;
  entryDate: string;    // YYYY-MM-DD
}

function EntryForm({
  goals,
  draft,
  onSave,
  onDelete,
  onCancel,
}: {
  goals: SavingsGoal[];
  draft: EntryDraft;
  onSave: (data: EntryDraft) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(draft.id);
  const [goalId, setGoalId] = useState(draft.goalId);
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : "");
  const [notes, setNotes] = useState(draft.notes || "");
  const [entryDate, setEntryDate] = useState(draft.entryDate);
  const activeGoal = goals.find((g) => g.id === goalId) || goals[0];

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    onSave({ id: draft.id, goalId, amount: Number(amount) || 0, notes: notes.trim(), entryDate });
  };

  return (
    <div class="savings-modal-overlay" onClick={onCancel}>
      <form class="savings-form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <span class="savings-form-kicker">{editing ? "EDITAR APORTE" : "REGISTRAR APORTE"}</span>
        <h3 class="savings-form-title">{editing ? "Editar aporte" : "Nuevo aporte de ahorro"}</h3>

        <label class="savings-field">
          <span>Meta</span>
          <div class="savings-goal-picker">
            {goals.map((g) => (
              <button
                type="button"
                key={g.id}
                class={`savings-goal-chip ${g.id === goalId ? "active" : ""}`}
                style={g.id === goalId ? { borderColor: g.color, color: g.color } : undefined}
                onClick={() => setGoalId(g.id)}
              >
                <span class="savings-goal-chip-dot" style={{ background: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        </label>

        <label class="savings-field">
          <span>Monto ($)</span>
          <input type="number" value={amount} onInput={(e: any) => setAmount(e.target.value)} placeholder="50.000" min="0" required autoFocus />
        </label>
        <label class="savings-field">
          <span>Fecha</span>
          <input type="date" value={entryDate} onInput={(e: any) => setEntryDate(e.target.value)} />
        </label>
        <label class="savings-field">
          <span>Notas</span>
          <input type="text" value={notes} onInput={(e: any) => setNotes(e.target.value)} placeholder="Opcional" />
        </label>

        <div class="savings-form-actions">
          {editing && onDelete && draft.id && (
            <button type="button" class="btn-danger" onClick={() => onDelete(draft.id!)}>Eliminar</button>
          )}
          <button type="button" class="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" class="btn-primary" disabled={!activeGoal}>{editing ? "Guardar" : "Registrar"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Main Island ──

export default function SavingsIsland({ monthlyIncome = null }: { monthlyIncome?: number | null }) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  // The aporte form is open whenever entryDraft is non-null (create or edit).
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [savingsView, setSavingsView] = useState<"annual" | "projection" | "staircase">("annual");

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [goalsRes, entriesRes] = await Promise.all([
        fetch("/api/savings/goals"),
        fetch("/api/savings/entries"),
      ]);
      if (!goalsRes.ok) throw new Error((await goalsRes.json()).error || "Error al cargar metas");
      if (!entriesRes.ok) throw new Error((await entriesRes.json()).error || "Error al cargar aportes");
      const goalsData = await goalsRes.json();
      const entriesData = await entriesRes.json();
      setGoals(goalsData.goals || []);
      setEntries(entriesData.entries || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreate = async (data: Partial<SavingsGoal>) => {
    try {
      const r = await fetch("/api/savings/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al crear meta");
      setShowGoalForm(false);
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (data: Partial<SavingsGoal>) => {
    if (!editingGoal) return;
    try {
      const r = await fetch(`/api/savings/goals/${editingGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al actualizar");
      setEditingGoal(null);
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta meta de ahorro?")) return;
    try {
      const r = await fetch(`/api/savings/goals/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Error al eliminar");
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSaveEntry = async (data: EntryDraft) => {
    if (!data.goalId || data.amount <= 0) return;
    try {
      const editing = Boolean(data.id);
      const r = await fetch("/api/savings/entries", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.id,
          goal_id: data.goalId,
          amount: data.amount,
          entry_date: data.entryDate,
          notes: data.notes || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al guardar aporte");
      setEntryDraft(null);
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const r = await fetch("/api/savings/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al eliminar aporte");
      setEntryDraft(null);
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Open the aporte form to create a new entry (optionally pre-selecting a goal
  // and month). Falls back to the first goal, or prompts to create one.
  const openNewEntry = (goalId?: string, monthKey?: string) => {
    const gid = goalId || goals[0]?.id;
    if (!gid) { setShowGoalForm(true); return; }
    const today = new Date().toISOString().slice(0, 10);
    setEntryDraft({
      goalId: gid,
      amount: 0,
      notes: "",
      entryDate: monthKey ? `${monthKey}-15` : today,
    });
  };

  const openEditEntry = (entry: SavingsEntry) => {
    setEntryDraft({
      id: entry.id,
      goalId: entry.goal_id,
      amount: Number(entry.amount) || 0,
      notes: entry.notes || "",
      entryDate: entry.entry_date,
    });
  };

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
  const monthlyContributionTotal = goals.reduce((s, g) => s + (Number(g.monthly_contribution) || 0), 0);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const actualByMonth = Array(12).fill(0) as number[];
  const yearEntries = entries.filter((entry) => entry.entry_date?.slice(0, 4) === String(currentYear));

  yearEntries.forEach((entry) => {
    const month = Number(entry.entry_date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) {
      actualByMonth[month] += Number(entry.amount) || 0;
    }
  });

  if (yearEntries.length === 0 && totalSaved > 0) {
    actualByMonth[currentMonthIndex] = totalSaved;
  }

  // Per-goal monthly amounts (for the stacked-by-goal breakdown in the charts).
  // Each goal gets a 12-slot array; entries without a recognised goal fall back
  // to the first goal so the total still reconciles.
  const goalMeta = goals.map((g) => ({ id: g.id, name: g.name, color: g.color || "#10B981" }));
  const perGoalByMonth: Record<string, number[]> = Object.fromEntries(
    goalMeta.map((g) => [g.id, Array(12).fill(0) as number[]])
  );
  yearEntries.forEach((entry) => {
    const month = Number(entry.entry_date.slice(5, 7)) - 1;
    if (month < 0 || month >= 12) return;
    const target = perGoalByMonth[entry.goal_id] ? entry.goal_id : goalMeta[0]?.id;
    if (target && perGoalByMonth[target]) {
      perGoalByMonth[target][month] += Number(entry.amount) || 0;
    }
  });
  // Fallback: no entries yet but goals carry a current_amount — seed the current
  // month per goal so the stack still reflects each goal's saved total.
  if (yearEntries.length === 0 && totalSaved > 0) {
    goals.forEach((g) => {
      if (perGoalByMonth[g.id]) perGoalByMonth[g.id][currentMonthIndex] = Number(g.current_amount) || 0;
    });
  }

  const completedMonths = actualByMonth.slice(0, currentMonthIndex + 1);
  const monthsWithSavings = completedMonths.filter((amount) => amount !== 0).length;
  const yearlyAccumulated = completedMonths.reduce((sum, amount) => sum + amount, 0);
  const avgMonthly = monthsWithSavings > 0 ? yearlyAccumulated / monthsWithSavings : 0;
  const projectionMonthly = monthlyContributionTotal > 0 ? monthlyContributionTotal : avgMonthly;
  const remainingMonthCount = Math.max(0, 11 - currentMonthIndex);
  const projectedFuture = projectionMonthly * remainingMonthCount;
  const projectedYearTotal = yearlyAccumulated + projectedFuture;

  // Per-month, per-goal breakdown carrying the underlying entries so each aporte
  // can be edited or deleted straight from the expandable monthly register.
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const annualMonthlyData = MONTHS_ABBR.map((month, index) => {
    const monthNum = String(index + 1).padStart(2, "0");
    const monthEntries = yearEntries.filter((e) => e.entry_date?.slice(5, 7) === monthNum);
    const byGoal = new Map<string, { id: string; name: string; color: string; amount: number; entries: SavingsEntry[] }>();
    monthEntries.forEach((e) => {
      const goal = goalById.get(e.goal_id) || goals[0];
      if (!goal) return;
      const bucket = byGoal.get(goal.id) || { id: goal.id, name: goal.name, color: goal.color || "#10B981", amount: 0, entries: [] };
      bucket.amount += Number(e.amount) || 0;
      bucket.entries.push(e);
      byGoal.set(goal.id, bucket);
    });
    return {
      month,
      monthKey: `${currentYear}-${monthNum}`,
      amount: index <= currentMonthIndex ? actualByMonth[index] : 0,
      goals: Array.from(byGoal.values()).sort((a, b) => b.amount - a.amount),
      is_current: index === currentMonthIndex,
      is_future: index > currentMonthIndex,
    };
  });

  const projectionMonthlyData = MONTHS_ABBR.map((month, index) => ({
    month,
    amount: index <= currentMonthIndex ? actualByMonth[index] : projectionMonthly,
    is_past: index < currentMonthIndex,
    is_current: index === currentMonthIndex,
    is_future: index > currentMonthIndex,
  }));

  let runningTotal = 0;
  const runningByGoal: Record<string, number> = Object.fromEntries(goalMeta.map((g) => [g.id, 0]));
  const staircaseMonthlyData = MONTHS_ABBR.map((month, index) => {
    const amount = index <= currentMonthIndex ? actualByMonth[index] : projectionMonthly;
    runningTotal += amount;
    // Accumulate each goal's running total so every bar can be drawn as a stack
    // of per-goal segments (segments are the goal's cumulative up to this month).
    goalMeta.forEach((g) => {
      runningByGoal[g.id] += index <= currentMonthIndex ? (perGoalByMonth[g.id]?.[index] || 0) : 0;
    });
    const segments = goalMeta
      .map((g) => ({ id: g.id, name: g.name, color: g.color, value: runningByGoal[g.id] }))
      .filter((s) => s.value > 0);
    return {
      month,
      amount,
      cumulative: runningTotal,
      segments,
      is_current: index === currentMonthIndex,
      is_future: index > currentMonthIndex,
    };
  });

  // Per-goal totals for the legend shown beneath the charts.
  const goalLegend = goalMeta
    .map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      amount: Object.values(perGoalByMonth[g.id] || {}).reduce((s, v) => s + v, 0),
    }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div class="savings-root">

      {error && <div class="savings-error">{error}<button onClick={() => setError("")}>×</button></div>}
      <div class="sv-controls" aria-label="Vistas de ahorro">
        <button class={`sv-btn ${savingsView === "annual" ? "active" : ""}`} aria-pressed={savingsView === "annual"} onClick={() => setSavingsView("annual")}>Meta</button>
        <button class={`sv-btn ${savingsView === "projection" ? "active" : ""}`} aria-pressed={savingsView === "projection"} onClick={() => setSavingsView("projection")}>Proyección</button>
        <button class={`sv-btn ${savingsView === "staircase" ? "active" : ""}`} aria-pressed={savingsView === "staircase"} onClick={() => setSavingsView("staircase")}>Acumulado</button>
      </div>

      {savingsView === "annual" && (
        <AnnualGoal
          goalName={`Meta anual ${currentYear}`}
          targetAmount={totalTarget || projectedYearTotal}
          currentSaved={yearlyAccumulated}
          monthlyContribution={monthlyContributionTotal || null}
          monthlyIncome={monthlyIncome}
          monthlyData={annualMonthlyData}
          goalLegend={goalLegend}
          year={currentYear}
          onAddEntry={(goalId, monthKey) => openNewEntry(goalId, monthKey)}
          onEditEntry={openEditEntry}
        />
      )}
      {savingsView === "projection" && (
        <AnnualProjection
          projectedTotal={Math.round(projectedYearTotal)}
          accumulated={Math.round(yearlyAccumulated)}
          projected={Math.round(projectedFuture)}
          monthlyData={projectionMonthlyData}
          year={currentYear}
          onAddEntry={() => openNewEntry()}
        />
      )}
      {savingsView === "staircase" && (
        <CumulativeStaircase
          totalSaved={Math.round(yearlyAccumulated)}
          projectionAmount={Math.round(projectedYearTotal)}
          monthlyData={staircaseMonthlyData}
          goalLegend={goalLegend}
          year={currentYear}
          onAddEntry={() => openNewEntry()}
        />
      )}

      {/* Goals list */}
      <div class="savings-header" style="margin-top:var(--space-lg)">
        <h2 class="savings-section-title">METAS DE AHORRO</h2>
        <button class="btn-primary" onClick={() => setShowGoalForm(true)}>
          <TctIcon name="plus" size={14} variant="dots" /> Nueva meta
        </button>
      </div>

      {loading && <div class="savings-empty">[CARGANDO...]</div>}
      {!loading && goals.length === 0 && !error && (
        <div class="savings-empty">[SIN METAS DE AHORRO]</div>
      )}
      {!loading && goals.length > 0 && (
        <div class="savings-grid">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={(goal) => setEditingGoal(goal)}
              onDelete={handleDelete}
              onAddEntry={(goal) => openNewEntry(goal.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showGoalForm && <GoalForm onSave={handleCreate} onCancel={() => setShowGoalForm(false)} />}
      {editingGoal && <GoalForm goal={editingGoal} onSave={handleUpdate} onCancel={() => setEditingGoal(null)} />}
      {entryDraft && (
        <EntryForm
          goals={goals}
          draft={entryDraft}
          onSave={handleSaveEntry}
          onDelete={handleDeleteEntry}
          onCancel={() => setEntryDraft(null)}
        />
      )}
    </div>
  );
}
