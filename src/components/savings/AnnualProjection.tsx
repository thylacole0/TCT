/** @jsxImportSource preact */

interface MonthlyBar {
  month: string;
  amount: number;
  is_past: boolean;
  is_current: boolean;
  is_future: boolean;
}

interface Props {
  projectedTotal: number;
  monthlyData: MonthlyBar[];
  accumulated: number;
  projected: number;
  year?: number;
  onAddEntry?: () => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

const MONTHS_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export default function AnnualProjection({
  projectedTotal,
  monthlyData,
  accumulated,
  projected,
  year = new Date().getFullYear(),
  onAddEntry,
}: Props) {
  const bars = MONTHS_ABBR.map((abbr) => {
    const found = monthlyData.find((m) => m.month === abbr);
    return found || { month: abbr, amount: 0, is_past: false, is_current: false, is_future: true };
  });

  const registeredBars = bars.filter((bar) => !bar.is_future && bar.amount > 0);
  const currentBar = bars.find((bar) => bar.is_current);
  const firstRegistered = registeredBars[0];
  const lastRegistered = registeredBars[registeredBars.length - 1];
  const maxAmount = Math.max(...bars.map((b) => b.amount), 1);
  const chartW = 340;
  const chartH = 118;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 20;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;
  const barW = (plotW / 12) - 7;
  const barGap = plotW / 12;

  return (
    <div class="sav-proj-root">
      <div class="sav-proj-card dot-grid-subtle">
        <span class="sav-proj-label">PROYECCIÓN {year}</span>
        <span class="sav-proj-total">{formatCLP(projectedTotal)}</span>
        <span class="sav-proj-subline">{formatCLP(accumulated)} acumulado · {formatCLP(projected)} restante proyectado</span>
      </div>

      <div class="sav-proj-evolution">
        <h3 class="sav-proj-section-title">EVOLUCIÓN {year}</h3>
        <div class="sav-proj-chart-wrap">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} class="sav-proj-chart">
            <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="var(--border-visible)" stroke-width="1" />
            {bars.map((bar, i) => {
              const x = padLeft + i * barGap + 3;
              const barHeight = bar.amount > 0 ? (bar.amount / maxAmount) * plotH : 0;
              const y = padTop + plotH - barHeight;

              if (bar.is_past || (bar.is_current && bar.amount > 0)) {
                return (
                  <g key={bar.month}>
                    <rect x={x} y={y} width={barW} height={barHeight} rx="2" fill={bar.is_current ? "var(--success)" : "var(--text-secondary)"} opacity={bar.is_current ? 1 : 0.72} />
                    <text x={x + barW / 2} y={padTop + plotH + 14} text-anchor="middle" class="sav-proj-bar-label" fill={bar.is_current ? "var(--success)" : "var(--text-tertiary)"}>{bar.month[0]}</text>
                  </g>
                );
              }

              const projH = bar.amount > 0 ? (bar.amount / maxAmount) * plotH : plotH * 0.65;
              return (
                <g key={bar.month}>
                  <rect x={x} y={padTop + plotH - projH} width={barW} height={projH} rx="2" fill="none" stroke={bar.is_current ? "var(--success)" : "var(--text-disabled)"} stroke-width={bar.is_current ? "1.5" : "1"} stroke-dasharray="3 3" />
                  <text x={x + barW / 2} y={padTop + plotH + 14} text-anchor="middle" class="sav-proj-bar-label" fill={bar.is_current ? "var(--success)" : "var(--text-disabled)"}>{bar.month[0]}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div class="sav-proj-legend">
          <div class="sav-proj-legend-item"><span class="sav-proj-legend-swatch" style="background: var(--text-secondary); opacity: 0.7;" /><span class="sav-proj-legend-text">Registrado</span></div>
          <div class="sav-proj-legend-item"><span class="sav-proj-legend-swatch" style="border: 1.5px dashed var(--success); background: none;" /><span class="sav-proj-legend-text">En curso</span></div>
          <div class="sav-proj-legend-item"><span class="sav-proj-legend-swatch" style="border: 1px dashed var(--text-disabled); background: none;" /><span class="sav-proj-legend-text">Proyectado</span></div>
        </div>
      </div>

      <div class="sav-proj-register">
        <h3 class="sav-proj-section-title">REGISTRO MENSUAL</h3>
        <div class="sav-proj-register-list">
          {registeredBars.length > 0 && firstRegistered && lastRegistered && (
            <div class="sav-proj-register-row">
              <span>{firstRegistered.month} - {lastRegistered.month} {year}</span>
              <strong>{formatCLP(accumulated)}</strong>
            </div>
          )}
          {currentBar && currentBar.amount === 0 && (
            <div class="sav-proj-register-row sav-proj-register-row-pending">
              <span><strong>{currentBar.month} {year}</strong><small>PENDIENTE</small></span>
              {onAddEntry && <button class="sav-proj-add-btn" onClick={onAddEntry}>+ AÑADIR</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}