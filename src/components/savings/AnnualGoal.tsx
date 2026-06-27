/** @jsxImportSource preact */

interface MonthlyEntry {
  month: string;
  amount: number;
  is_current: boolean;
  is_future: boolean;
}

interface Props {
  goalName: string;
  targetAmount: number;
  currentSaved: number;
  monthlyContribution: number | null;
  monthlyIncome: number | null;
  monthlyData: MonthlyEntry[];
  year?: number;
  onAddEntry?: () => void;
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
  year = new Date().getFullYear(),
  onAddEntry,
}: Props) {
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

  return (
    <div class="sav-goal-root">
      <div class="sav-goal-donut">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
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
              stroke-linecap="round"
              class="sav-goal-donut-arc"
            />
          </g>
          <text x={center} y={center - 4} text-anchor="middle" class="sav-goal-donut-pct">
            {formatCompactCLP(currentSaved)}
          </text>
          <text x={center} y={center + 18} text-anchor="middle" class="sav-goal-donut-label">
            {formatPct(progressPct)} DE LA META
          </text>
        </svg>
      </div>

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
        <h3 class="sav-goal-register-title">REGISTRO MENSUAL</h3>
        <div class="sav-goal-register-list">
          {visibleMonths.map((entry) => {
            const pctOfGoal = targetAmount > 0 ? (entry.amount / targetAmount) * 100 : 0;
            const isCurrentPending = entry.is_current && entry.amount === 0;

            return (
              <div
                key={entry.month}
                class={`sav-goal-row ${entry.is_current ? "sav-goal-row-current" : ""} ${isCurrentPending ? "sav-goal-row-pending" : ""}`}
              >
                <span class="sav-goal-row-month">{entry.month} {year}</span>
                {isCurrentPending ? (
                  <span class="sav-goal-row-pending-label">PENDIENTE</span>
                ) : (
                  <>
                    <span class="sav-goal-row-pct">{formatPct(pctOfGoal)}</span>
                    <span class="sav-goal-row-amount">{formatCLP(entry.amount)}</span>
                  </>
                )}
                {isCurrentPending && onAddEntry && (
                  <button class="sav-goal-add-btn" onClick={onAddEntry}>+ AÑADIR</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}