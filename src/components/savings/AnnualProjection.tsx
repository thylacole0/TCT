/** @jsxImportSource preact */

interface MonthlyBar {
  month: string;       // "ENE", "FEB", etc.
  amount: number;
  is_past: boolean;
  is_current: boolean;
  is_future: boolean;
}

interface Props {
  projectedTotal: number;
  monthlyData: MonthlyBar[];
  accumulated: number;   // sum of past + current
  projected: number;     // sum of future
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
}: Props) {
  // Ensure 12 months always
  const bars = MONTHS_ABBR.map((abbr) => {
    const found = monthlyData.find((m) => m.month === abbr);
    return found || { month: abbr, amount: 0, is_past: false, is_current: false, is_future: true };
  });

  const maxAmount = Math.max(...bars.map((b) => b.amount), 1);

  // SVG bar chart
  const chartW = 340;
  const chartH = 140;
  const padLeft = 4;
  const padRight = 4;
  const padTop = 8;
  const padBottom = 20;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;
  const barW = (plotW / 12) - 6;
  const barGap = (plotW / 12);

  return (
    <div class="sav-proj-root">
      {/* Card with dot-grid background */}
      <div class="sav-proj-card dot-grid-subtle">
        <span class="sav-proj-label">PROYECCIÓN ANUAL</span>
        <span class="sav-proj-total">{formatCLP(projectedTotal)}</span>

        {/* Bar Chart */}
        <div class="sav-proj-chart-wrap">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} class="sav-proj-chart">
            {/* Baseline */}
            <line
              x1={padLeft}
              y1={padTop + plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH}
              stroke="var(--border-visible)"
              stroke-width="1"
            />

            {bars.map((bar, i) => {
              const x = padLeft + i * barGap + 3;
              const barHeight = bar.amount > 0 ? (bar.amount / maxAmount) * plotH : 0;
              const y = padTop + plotH - barHeight;

              if (bar.is_past || (bar.is_current && bar.amount > 0)) {
                // Solid bar
                return (
                  <g key={bar.month}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barHeight}
                      rx="3"
                      fill={bar.is_current ? "var(--accent)" : "var(--text-secondary)"}
                      opacity={bar.is_current ? 1 : 0.6}
                    />
                    <text
                      x={x + barW / 2}
                      y={padTop + plotH + 14}
                      text-anchor="middle"
                      class="sav-proj-bar-label"
                      fill={bar.is_current ? "var(--accent)" : "var(--text-tertiary)"}
                    >
                      {bar.month}
                    </text>
                  </g>
                );
              } else if (bar.is_current && bar.amount === 0) {
                // Current month, no entry yet — dashed outline
                const dashH = plotH * 0.2; // placeholder height
                return (
                  <g key={bar.month}>
                    <rect
                      x={x}
                      y={padTop + plotH - dashH}
                      width={barW}
                      height={dashH}
                      rx="3"
                      fill="none"
                      stroke="var(--success)"
                      stroke-width="1.5"
                      stroke-dasharray="4 3"
                    />
                    <text
                      x={x + barW / 2}
                      y={padTop + plotH + 14}
                      text-anchor="middle"
                      class="sav-proj-bar-label"
                      fill="var(--success)"
                    >
                      {bar.month}
                    </text>
                  </g>
                );
              } else {
                // Future — dashed gray projection
                const projH = bar.amount > 0 ? (bar.amount / maxAmount) * plotH : plotH * 0.15;
                return (
                  <g key={bar.month}>
                    <rect
                      x={x}
                      y={padTop + plotH - projH}
                      width={barW}
                      height={projH}
                      rx="3"
                      fill="none"
                      stroke="var(--text-disabled)"
                      stroke-width="1"
                      stroke-dasharray="3 3"
                    />
                    <text
                      x={x + barW / 2}
                      y={padTop + plotH + 14}
                      text-anchor="middle"
                      class="sav-proj-bar-label"
                      fill="var(--text-disabled)"
                    >
                      {bar.month}
                    </text>
                  </g>
                );
              }
            })}
          </svg>
        </div>

        {/* Legend */}
        <div class="sav-proj-legend">
          <div class="sav-proj-legend-item">
            <span class="sav-proj-legend-swatch" style="background: var(--text-secondary); opacity: 0.6;" />
            <span class="sav-proj-legend-text">REAL</span>
          </div>
          <div class="sav-proj-legend-item">
            <span class="sav-proj-legend-swatch" style="border: 1.5px dashed var(--success); background: none;" />
            <span class="sav-proj-legend-text">MES ACTUAL</span>
          </div>
          <div class="sav-proj-legend-item">
            <span class="sav-proj-legend-swatch" style="border: 1px dashed var(--text-disabled); background: none;" />
            <span class="sav-proj-legend-text">PROYECTADO</span>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div class="sav-proj-summary">
        <div class="sav-proj-summary-item">
          <span class="sav-proj-summary-value">{formatCLP(accumulated)}</span>
          <span class="sav-proj-summary-label">ACUMULADO</span>
        </div>
        <div class="sav-proj-summary-item">
          <span class="sav-proj-summary-value">{formatCLP(projected)}</span>
          <span class="sav-proj-summary-label">PROYECTADO</span>
        </div>
      </div>
    </div>
  );
}
