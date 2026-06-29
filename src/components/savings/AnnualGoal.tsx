/** @jsxImportSource preact */
import { useState } from "preact/hooks";
import TctIcon from "../icons/TctIcon";

interface SavingsEntry {
  id: string;
  goal_id: string;
  amount: number;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

interface MonthGoalBucket {
  id: string;
  name: string;
  color: string;
  amount: number;
  entries: SavingsEntry[];
}

interface MonthlyEntry {
  month: string;
  monthKey?: string;
  amount: number;
  goals?: MonthGoalBucket[];
  is_current: boolean;
  is_future: boolean;
}

interface GoalLegendItem {
  id: string;
  name: string;
  color: string;
  amount: number;
}

interface Props {
  goalName: string;
  targetAmount: number;
  currentSaved: number;
  monthlyContribution: number | null;
  monthlyIncome: number | null;
  monthlyData: MonthlyEntry[];
  goalLegend?: GoalLegendItem[];
  year?: number;
  onAddEntry?: (goalId?: string, monthKey?: string) => void;
  onEditEntry?: (entry: SavingsEntry) => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function formatCompactCLP(n: number) {
  const rounded = Math.round(n);
  if (Math.abs(rounded) >= 1000000) {
    const value = rounded / 1000000;
    return `$${value.toLocaleString("es-CL", { maximumFractionDigits: value % 1 === 0 ? 0 : 1 })}M`;
  }
  if (Math.abs(rounded) >= 1000) return `$${Math.round(rounded / 1000).toLocaleString("es-CL")}k`;
  return formatCLP(rounded);
}

function formatPct(n: number) {
  return `${Math.round(n)}%`;
}

export default function AnnualGoal({
  targetAmount,
  currentSaved,
  monthlyContribution,
  monthlyIncome,
  monthlyData,
  goalLegend = [],
  year = new Date().getFullYear(),
  onAddEntry,
  onEditEntry,
}: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const progressPct = targetAmount > 0 ? Math.min(100, (currentSaved / targetAmount) * 100) : 0;
  const salaryPct = monthlyIncome && monthlyIncome > 0
    ? ((monthlyContribution || 0) / monthlyIncome) * 100
    : null;
  const monthsRemaining = monthlyContribution && monthlyContribution > 0 && currentSaved < targetAmount
    ? Math.ceil((targetAmount - currentSaved) / monthlyContribution)
    : null;

  const visibleMonths = monthlyData.filter((m) => !m.is_future);
  const registeredMonths = visibleMonths.filter((m) => m.amount > 0);
  const avgMonthly = registeredMonths.length > 0
    ? registeredMonths.reduce((s, m) => s + m.amount, 0) / registeredMonths.length
    : 0;

  const size = 190;
  const center = size / 2;
  const radius = 70;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (progressPct / 100) * circumference;
  const remaining = circumference - dashLength;

  // Outer ring: each goal gets an arc proportional to its share of the total
  // saved, so you can see how the accumulated amount splits across goals.
  const outerRadius = radius + strokeWidth / 2 + 7;
  const outerStroke = 5;
  const outerCirc = 2 * Math.PI * outerRadius;
  const legendTotal = goalLegend.reduce((s, g) => s + g.amount, 0);
  let outerOffset = 0;
  const outerArcs = legendTotal > 0
    ? goalLegend.map((g) => {
        const frac = g.amount / legendTotal;
        const len = frac * outerCirc;
        const gap = 2; // tiny gap between arcs
        const arc = {
          color: g.color,
          dash: `${Math.max(0, len - gap)} ${outerCirc - Math.max(0, len - gap)}`,
          offset: -outerOffset,
        };
        outerOffset += len;
        return arc;
      })
    : [];

  return (
    <div class="sav-goal-root">
      <div class="sav-goal-donut">
        <div class="sav-goal-donut-graphic" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
            {/* Outer ring: per-goal split of the accumulated total */}
            {outerArcs.length > 0 && (
              <g transform={`rotate(-90 ${center} ${center})`}>
                {outerArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx={center}
                    cy={center}
                    r={outerRadius}
                    fill="none"
                    stroke={arc.color}
                    stroke-width={outerStroke}
                    stroke-dasharray={arc.dash}
                    stroke-dashoffset={arc.offset}
                  />
                ))}
              </g>
            )}
            {/* Inner ring: overall progress toward the annual goal */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--surface)" stroke-width={strokeWidth} />
            <g transform={`rotate(-90 ${center} ${center})`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="var(--success)"
                stroke-width={strokeWidth}
                stroke-dasharray={`${dashLength} ${remaining}`}
                stroke-linecap={dashLength > 0 ? "round" : "butt"}
                class="sav-goal-donut-arc"
              />
            </g>
          </svg>
          <div class="sav-goal-donut-center">
            <span class="sav-goal-donut-pct">{formatCompactCLP(currentSaved)}</span>
            <span class="sav-goal-donut-label">{formatPct(progressPct)} DE LA META</span>
          </div>
        </div>
      </div>

      {goalLegend.length > 0 && (
        <div class="sav-goal-legend">
          {goalLegend.map((g) => {
            const share = legendTotal > 0 ? Math.round((g.amount / legendTotal) * 100) : 0;
            return (
              <div key={g.id} class="sav-goal-legend-item">
                <span class="sav-goal-legend-dot" style={{ background: g.color }} />
                <span class="sav-goal-legend-name">{g.name}</span>
                <span class="sav-goal-legend-amount">{formatCompactCLP(g.amount)}</span>
                <span class="sav-goal-legend-pct">{share}%</span>
              </div>
            );
          })}
        </div>
      )}

      <div class="sav-goal-target">META ANUAL {year}: {formatCLP(targetAmount)}</div>

      <div class="sav-goal-stats sav-goal-stats-ref">
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-label">PROMEDIO</span>
          <span class="sav-goal-stat-value">{formatCLP(avgMonthly)}</span>
        </div>
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-label">% SUELDO</span>
          <span class="sav-goal-stat-value sav-goal-stat-green">{salaryPct === null ? "-" : formatPct(salaryPct)}</span>
        </div>
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-label">AL RITMO ACTUAL</span>
          <span class="sav-goal-stat-value">{monthsRemaining === null ? "-" : `${monthsRemaining} MES`}</span>
        </div>
      </div>

      <div class="sav-goal-register">
        <div class="sav-goal-register-head">
          <h3 class="sav-goal-register-title">REGISTRO MENSUAL</h3>
          {onAddEntry && (
            <button class="sav-goal-add-btn" onClick={() => onAddEntry()}>+ APORTE</button>
          )}
        </div>
        <div class="sav-goal-register-list">
          {visibleMonths.map((entry) => {
            const pctOfGoal = targetAmount > 0 ? (entry.amount / targetAmount) * 100 : 0;
            const isCurrentPending = entry.is_current && entry.amount === 0;
            const buckets = entry.goals || [];
            const canExpand = buckets.length > 0;
            const isExpanded = expandedMonth === entry.month;

            return (
              <div key={entry.month} class="sav-goal-month">
                <div
                  class={`sav-goal-row ${entry.is_current ? "sav-goal-row-current" : ""} ${isCurrentPending ? "sav-goal-row-pending" : ""} ${canExpand ? "sav-goal-row-clickable" : ""}`}
                  role={canExpand ? "button" : undefined}
                  tabIndex={canExpand ? 0 : undefined}
                  aria-expanded={canExpand ? isExpanded : undefined}
                  onClick={canExpand ? () => setExpandedMonth(isExpanded ? null : entry.month) : undefined}
                >
                  <span class="sav-goal-row-month">
                    {canExpand && (
                      <span class={`sav-goal-chevron ${isExpanded ? "open" : ""}`}>
                        <TctIcon name="chevronDown" size={12} variant="dots" />
                      </span>
                    )}
                    {entry.month} {year}
                  </span>
                  {isCurrentPending ? (
                    <span class="sav-goal-row-pending-label">PENDIENTE</span>
                  ) : (
                    <>
                      <span class="sav-goal-row-pct">{formatPct(pctOfGoal)}</span>
                      <span class="sav-goal-row-amount">{formatCLP(entry.amount)}</span>
                    </>
                  )}
                  {isCurrentPending && onAddEntry && (
                    <button
                      class="sav-goal-add-btn"
                      onClick={(e) => { e.stopPropagation(); onAddEntry(undefined, entry.monthKey); }}
                    >
                      + AÑADIR
                    </button>
                  )}
                </div>

                {canExpand && isExpanded && (
                  <div class="sav-goal-breakdown">
                    {buckets.map((b) => (
                      <div key={b.id} class="sav-goal-breakdown-goal">
                        <div class="sav-goal-breakdown-head">
                          <span class="sav-goal-breakdown-name">
                            <span class="sav-goal-legend-dot" style={{ background: b.color }} />
                            {b.name}
                          </span>
                          <span class="sav-goal-breakdown-total">{formatCLP(b.amount)}</span>
                        </div>
                        {b.entries.map((ent) => (
                          <button
                            key={ent.id}
                            class="sav-goal-entry"
                            onClick={() => onEditEntry?.(ent)}
                            disabled={!onEditEntry}
                          >
                            <span class="sav-goal-entry-date">{ent.entry_date}</span>
                            <span class="sav-goal-entry-note">{ent.notes || "—"}</span>
                            <span class="sav-goal-entry-amount">{formatCLP(ent.amount)}</span>
                            {onEditEntry && <TctIcon name="edit" size={12} variant="dots" />}
                          </button>
                        ))}
                      </div>
                    ))}
                    {onAddEntry && (
                      <button
                        class="sav-goal-breakdown-add"
                        onClick={() => onAddEntry(undefined, entry.monthKey)}
                      >
                        + Agregar aporte en {entry.month}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}