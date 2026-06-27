/** @jsxImportSource preact */

interface MonthlyEntry {
  month: string;       // "ENE", "FEB", etc.
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
  onAddEntry?: () => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function formatPct(n: number) {
  return `${Math.round(n)}%`;
}

export default function AnnualGoal({
  goalName,
  targetAmount,
  currentSaved,
  monthlyContribution,
  monthlyIncome,
  monthlyData,
  onAddEntry,
}: Props) {
  const progressPct = targetAmount > 0 ? Math.min(100, (currentSaved / targetAmount) * 100) : 0;
  const salaryPct = monthlyIncome && monthlyIncome > 0
    ? (monthlyContribution || 0) / monthlyIncome * 100
    : null;
  const monthsRemaining = monthlyContribution && monthlyContribution > 0 && currentSaved < targetAmount
    ? Math.ceil((targetAmount - currentSaved) / monthlyContribution)
    : null;

  // Average monthly from past + current months
  const completedMonths = monthlyData.filter((m) => !m.is_future);
  const avgMonthly = completedMonths.length > 0
    ? completedMonths.reduce((s, m) => s + m.amount, 0) / completedMonths.length
    : 0;

  // SVG Donut Ring
  const size = 180;
  const center = size / 2;
  const radius = 68;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (progressPct / 100) * circumference;
  const remaining = circumference - dashLength;

  return (
    <div class="sav-goal-root">
      {/* Header */}
      <h2 class="sav-goal-name">{goalName}</h2>

      {/* Donut Ring */}
      <div class="sav-goal-donut">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface)"
            stroke-width={strokeWidth}
          />
          {/* Progress arc — rotated to start from top */}
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--accent)"
              stroke-width={strokeWidth}
              stroke-dasharray={`${dashLength} ${remaining}`}
              stroke-linecap="round"
              class="sav-goal-donut-arc"
            />
          </g>
          {/* Center text */}
          <text x={center} y={center - 6} text-anchor="middle" class="sav-goal-donut-pct">
            {formatPct(progressPct)}
          </text>
          <text x={center} y={center + 16} text-anchor="middle" class="sav-goal-donut-label">
            AHORRADO
          </text>
        </svg>
      </div>

      {/* Stats Row */}
      <div class="sav-goal-stats">
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-value">{formatCLP(currentSaved)}</span>
          <span class="sav-goal-stat-label">AHORRADO</span>
        </div>
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-value">{formatCLP(targetAmount)}</span>
          <span class="sav-goal-stat-label">META</span>
        </div>
        <div class="sav-goal-stat">
          <span class="sav-goal-stat-value">{formatCLP(avgMonthly)}</span>
          <span class="sav-goal-stat-label">PROMEDIO</span>
        </div>
        {salaryPct !== null && (
          <div class="sav-goal-stat">
            <span class="sav-goal-stat-value">{formatPct(salaryPct)}</span>
            <span class="sav-goal-stat-label">% SUELDO</span>
          </div>
        )}
        {monthsRemaining !== null && (
          <div class="sav-goal-stat">
            <span class="sav-goal-stat-value">{monthsRemaining}</span>
            <span class="sav-goal-stat-label">{monthsRemaining === 1 ? "MES" : "MESES"}</span>
          </div>
        )}
      </div>

      {/* Monthly Register */}
      <div class="sav-goal-register">
        <h3 class="sav-goal-register-title">REGISTRO MENSUAL</h3>
        <div class="sav-goal-register-list">
          {monthlyData.map((entry) => {
            const pctOfGoal = targetAmount > 0 ? (entry.amount / targetAmount) * 100 : 0;
            const isCurrentPending = entry.is_current && entry.amount === 0;

            return (
              <div
                key={entry.month}
                class={`sav-goal-row ${entry.is_current ? "sav-goal-row-current" : ""} ${entry.is_future ? "sav-goal-row-future" : ""} ${isCurrentPending ? "sav-goal-row-pending" : ""}`}
              >
                <span class="sav-goal-row-month">{entry.month}</span>
                {isCurrentPending ? (
                  <span class="sav-goal-row-pending-label">PENDIENTE</span>
                ) : (
                  <span class={`sav-goal-row-amount ${entry.is_future ? "sav-goal-row-amount-dim" : ""}`}>
                    {entry.is_future ? "—" : formatCLP(entry.amount)}
                  </span>
                )}
                <span class={`sav-goal-row-pct ${entry.is_future ? "sav-goal-row-pct-dim" : ""}`}>
                  {entry.is_future ? "—" : formatPct(pctOfGoal)}
                </span>
                {isCurrentPending && onAddEntry && (
                  <button class="sav-goal-add-btn" onClick={onAddEntry}>
                    + AÑADIR
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
