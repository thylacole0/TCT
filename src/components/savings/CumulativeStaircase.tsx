/** @jsxImportSource preact */

interface StairStep {
  month: string;
  amount: number;
  cumulative: number;
  is_current: boolean;
  is_future: boolean;
}

interface Props {
  totalSaved: number;
  monthlyData: StairStep[];
  projectionAmount: number;
  year?: number;
  onAddEntry?: () => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function formatCompactCLP(n: number) {
  const rounded = Math.round(n);
  if (Math.abs(rounded) >= 1000000) return `$${Math.round(rounded / 1000).toLocaleString("es-CL")}k`;
  if (Math.abs(rounded) >= 1000) return `$${Math.round(rounded / 1000).toLocaleString("es-CL")}k`;
  return `$${rounded}`;
}

export default function CumulativeStaircase({
  totalSaved,
  monthlyData,
  projectionAmount,
  year = new Date().getFullYear(),
}: Props) {
  const registeredSteps = monthlyData.filter((m) => !m.is_future && m.amount > 0);
  const chartSteps = registeredSteps.length > 0 ? registeredSteps : monthlyData.filter((m) => !m.is_future);
  const average = registeredSteps.length > 0 ? totalSaved / registeredSteps.length : 0;
  const maxCum = Math.max(...chartSteps.map((m) => m.cumulative), projectionAmount, 1);
  const chartW = 340;
  const chartH = 126;
  const padLeft = 12;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 24;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;
  const stepCount = Math.max(chartSteps.length, 1);
  const stepW = plotW / (stepCount + 1);

  const sy = (value: number) => padTop + plotH - (value / maxCum) * plotH;
  const linePoints = chartSteps.map((step, i) => ({
    x: padLeft + i * stepW + stepW / 2,
    y: sy(step.cumulative),
  }));
  const realPathD = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const lastPoint = linePoints[linePoints.length - 1];
  const projX = lastPoint ? lastPoint.x + stepW : padLeft + stepW;
  const projY = sy(projectionAmount);

  return (
    <div class="sav-stair-root">
      <div class="sav-stair-hero">
        <span class="sav-stair-hero-label">AHORRO ACUMULADO {year}</span>
        <span class="sav-stair-hero-value">{formatCLP(totalSaved)}</span>
        <span class="sav-stair-hero-sub">{registeredSteps.length} meses registrados · promedio {formatCLP(average)}/mes</span>
      </div>

      <div class="sav-stair-chart-card">
        <h3 class="sav-stair-chart-title">TOTAL ACUMULADO MES A MES</h3>
        <div class="sav-stair-chart-wrap">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} class="sav-stair-chart">
            <line x1={padLeft} y1={padTop + plotH} x2={chartW - padRight} y2={padTop + plotH} stroke="var(--border-visible)" stroke-width="1" />
            {chartSteps.map((step, i) => {
              const x = padLeft + i * stepW;
              const barW = stepW - 4;
              const barH = (step.cumulative / maxCum) * plotH;
              const y = padTop + plotH - barH;
              const isLatest = i === chartSteps.length - 1;
              return (
                <g key={step.month}>
                  <rect x={x} y={y} width={barW} height={barH} rx="2" fill={isLatest ? "var(--success)" : "var(--surface-raised)"} opacity={isLatest ? 1 : 0.95} />
                  <text x={x + barW / 2} y={y - 5} text-anchor="middle" class="sav-stair-cum-label" fill={isLatest ? "var(--success)" : "var(--text-tertiary)"}>{formatCompactCLP(step.cumulative)}</text>
                  <text x={x + barW / 2} y={padTop + plotH + 15} text-anchor="middle" class="sav-stair-bar-label" fill={isLatest ? "var(--success)" : "var(--text-tertiary)"}>{step.month}</text>
                </g>
              );
            })}
            {realPathD && <path d={realPathD} fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-dasharray="3 2" />}
            {lastPoint && projectionAmount > totalSaved && (
              <>
                <line x1={lastPoint.x} y1={lastPoint.y} x2={projX} y2={projY} stroke="var(--text-disabled)" stroke-width="1.5" stroke-dasharray="4 3" />
                <text x={projX} y={projY - 5} text-anchor="middle" class="sav-stair-cum-label" fill="var(--text-disabled)">~{formatCompactCLP(projectionAmount)}</text>
              </>
            )}
          </svg>
        </div>
      </div>

      <div class="sav-stair-list">
        <h3 class="sav-stair-list-title">DETALLE MENSUAL</h3>
        {registeredSteps.map((step, index) => {
          const isLatest = index === registeredSteps.length - 1;
          return (
            <div key={step.month} class={`sav-stair-row ${isLatest ? "sav-stair-row-current" : ""}`}>
              <span class="sav-stair-row-month">{step.month}</span>
              <span class="sav-stair-row-add">+{formatCompactCLP(step.amount)}</span>
              <span class={`sav-stair-row-cum ${isLatest ? "sav-stair-row-cum-latest" : ""}`}>{formatCLP(step.cumulative)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}