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
  return (
    <div class="savings-card" style={{ borderColor: goal.color + "40" }}>
      <div class="savings-card-header">
        <div class="savings-card-icon" style={{ background: goal.color + "20", color: goal.color }}>
          <TctIcon name={goal.icon || "piggy-bank"} size={18} />
        </div>
        <div class="savings-card-title">
          <span class="savings-card-name">{goal.name}</span>
          {remaining !== null && (
            <span class="savings-card-eta">{remaining} {remaining === 1 ? "mes" : "meses"} restantes</span>
          )}
        </div>
        <div class="savings-card-actions">
          <button class="btn-icon" onClick={() => onAddEntry(goal)} title="Agregar aporte"><TctIcon name="plus" size={14} /></button>
          <button class="btn-icon" onClick={() => onEdit(goal)} title="Editar"><TctIcon name="edit" size={14} /></button>
          <button class="btn-icon btn-icon-danger" onClick={() => onDelete(goal.id)} title="Eliminar"><TctIcon name="trash" size={14} /></button>
        </div>
      </div>
      <ProgressBar current={goal.current_amount} target={goal.target_amount} color={goal.color} />
      <div class="savings-card-amounts">
        <div>
          <span class="savings-label">Ahorrado</span>
          <span class="savings-value">{formatCLP(goal.current_amount)}</span>
        </div>
        <div>
          <span class="savings-label">Meta</span>
          <span class="savings-value">{formatCLP(goal.target_amount)}</span>
        </div>
        {goal.monthly_contribution ? (
          <div>
            <span class="savings-label">Aporte mensual</span>
            <span class="savings-value">{formatCLP(goal.monthly_contribution)}</span>
          </div>
        ) : null}
      </div>
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
        <h3 class="savings-form-title">{goal ? "Editar meta" : "Nueva meta de ahorro"}</h3>
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

function EntryForm({
  goal,
  onSave,
  onCancel,
}: {
  goal: SavingsGoal;
  onSave: (amount: number, notes: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    onSave(Number(amount) || 0, notes.trim());
  };

  return (
    <div class="savings-modal-overlay" onClick={onCancel}>
      <form class="savings-form" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3 class="savings-form-title">Agregar aporte — {goal.name}</h3>
        <label class="savings-field">
          <span>Monto ($)</span>
          <input type="number" value={amount} onInput={(e: any) => setAmount(e.target.value)} placeholder="50.000" min="0" required autoFocus />
        </label>
        <label class="savings-field">
          <span>Notas</span>
          <input type="text" value={notes} onInput={(e: any) => setNotes(e.target.value)} placeholder="Opcional" />
        </label>
        <div class="savings-form-actions">
          <button type="button" class="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" class="btn-primary">Registrar</button>
        </div>
      </form>
    </div>
  );
}

// ── Main Island ──

export default function SavingsIsland() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [entryGoal, setEntryGoal] = useState<SavingsGoal | null>(null);
  const [savingsView, setSavingsView] = useState<"annual" | "projection" | "staircase">("annual");

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/savings/goals");
      if (!r.ok) throw new Error((await r.json()).error || "Error al cargar metas");
      const data = await r.json();
      setGoals(data.goals || []);
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

  const handleAddEntry = async (amount: number, notes: string) => {
    if (!entryGoal) return;
    try {
      const r = await fetch("/api/savings/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: entryGoal.id, amount, notes: notes || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al registrar aporte");
      setEntryGoal(null);
      fetchGoals();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <div class="savings-root">
      {/* Overview */}
      <div class="savings-overview">
        <div class="savings-overview-card">
          <div class="savings-overview-icon"><TctIcon name="piggy-bank" size={20} variant="dots" /></div>
          <div>
            <span class="savings-label">AHORROS TOTALES</span>
            <span class="savings-value-lg">{formatCLP(totalSaved)}</span>
          </div>
        </div>
        <div class="savings-overview-card">
          <div class="savings-overview-icon"><TctIcon name="target" size={20} variant="dots" /></div>
          <div>
            <span class="savings-label">META GLOBAL</span>
            <span class="savings-value-lg">{formatCLP(totalTarget)}</span>
          </div>
        </div>
        <div class="savings-overview-card">
          <ProgressBar current={totalSaved} target={totalTarget} color="var(--accent)" />
        </div>
      </div>

      {/* Header */}
      <div class="savings-header">
        <h2 class="savings-section-title">METAS DE AHORRO</h2>
        <button class="btn-primary" onClick={() => setShowGoalForm(true)}>
          <TctIcon name="plus" size={14} /> Nueva meta
        </button>
      </div>

      {/* Error */}
      {error && <div class="savings-error">{error}<button onClick={() => setError("")}>×</button></div>}

      {/* Loading */}
      {loading && <div class="savings-empty">[CARGANDO...]</div>}

      {/* Empty */}
      {!loading && goals.length === 0 && !error && (
        <div class="savings-empty">[SIN METAS DE AHORRO]</div>
      )}

      {goals.length > 0 && (
        <>
          {/* View buttons */}
          <div class="sv-controls">
            <button class={`sv-btn ${savingsView === "annual" ? "active" : ""}`} onClick={() => setSavingsView("annual")}>META ANUAL</button>
            <button class={`sv-btn ${savingsView === "projection" ? "active" : ""}`} onClick={() => setSavingsView("projection")}>PROYECCIÓN</button>
            <button class={`sv-btn ${savingsView === "staircase" ? "active" : ""}`} onClick={() => setSavingsView("staircase")}>ACUMULADO</button>
          </div>

          {/* Views */}
          {savingsView === "annual" && (
            <AnnualGoal
              goalName={goals[0]?.name || "Ahorro"}
              targetAmount={totalTarget || 2000000}
              currentSaved={totalSaved}
              monthlyContribution={goals[0]?.monthly_contribution || null}
              monthlyIncome={null}
              monthlyData={goals.map((g, i) => ({
                month: new Date(2026, i, 1).toLocaleDateString("es-CL", { month: "short" }).toUpperCase().replace(".", ""),
                amount: g.current_amount,
                is_current: i === goals.length - 1,
                is_future: false,
              }))}
              onAddEntry={() => goals[0] && setEntryGoal(goals[0])}
            />
          )}
          {savingsView === "projection" && (
            <AnnualProjection
              projectedTotal={Math.round(totalSaved * 1.5)}
              accumulated={totalSaved}
              projected={Math.round(totalSaved * 0.5)}
              monthlyData={goals.map((g, i) => ({
                month: new Date(2026, i, 1).toLocaleDateString("es-CL", { month: "short" }).toUpperCase().replace(".", ""),
                amount: g.current_amount,
                is_past: i < goals.length - 1,
                is_current: i === goals.length - 1,
                is_future: false,
              }))}
            />
          )}
          {savingsView === "staircase" && (
            <CumulativeStaircase
              totalSaved={totalSaved}
              projectionAmount={Math.round(totalSaved * 1.5)}
              monthlyData={goals.map((g, i) => ({
                month: new Date(2026, i, 1).toLocaleDateString("es-CL", { month: "short" }).toUpperCase().replace(".", ""),
                amount: g.current_amount,
                cumulative: goals.slice(0, i + 1).reduce((s, g2) => s + g2.current_amount, 0),
                is_current: i === goals.length - 1,
                is_future: false,
              }))}
              onAddEntry={() => goals[0] && setEntryGoal(goals[0])}
            />
          )}

          {/* Goals list */}
          <div class="savings-header" style="margin-top:var(--space-lg)">
            <h2 class="savings-section-title">METAS DE AHORRO</h2>
            <button class="btn-primary" onClick={() => setShowGoalForm(true)}>
              <TctIcon name="plus" size={14} /> Nueva meta
            </button>
          </div>
          <div class="savings-grid">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={(goal) => setEditingGoal(goal)}
                onDelete={handleDelete}
                onAddEntry={(goal) => setEntryGoal(goal)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {showGoalForm && <GoalForm onSave={handleCreate} onCancel={() => setShowGoalForm(false)} />}
      {editingGoal && <GoalForm goal={editingGoal} onSave={handleUpdate} onCancel={() => setEditingGoal(null)} />}
      {entryGoal && <EntryForm goal={entryGoal} onSave={handleAddEntry} onCancel={() => setEntryGoal(null)} />}
    </div>
  );
}
