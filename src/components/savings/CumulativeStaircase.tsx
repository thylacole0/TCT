/** @jsxImportSource preact */

interface StairStep {
  month: string;       // "ENE", "FEB", etc.
  amount: number;      // amount added this month
  cumulative: number;  // running total after this month
  is_current: boolean;
  is_future: boolean;
}

interface Props {
  totalSaved: number;
  monthlyData: StairStep[];
  projectionAmount: number;  // projected future cumulative total
  onAddEntry?: () => void;
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

export default function CumulativeStaircase({
  totalSaved,
  monthlyData,
  projectionAmount,
  onAddEntry,
}: Props) {
  // Find max cumulative for scaling
  const allCumulatives = [
    ...monthlyData.map((m) => m.cumulative),
    projectionAmount,
  ];
  const maxCum = Math.max(...allCumulatives, 1);

  const chartW = 340;
  const chartH = 160;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 28;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const allSteps = monthlyData;
  const stepCount = allSteps.length;
  const stepW = stepCount > 0 ? plotW / stepCount : plotW;

  // Build staircase points and line points
  const linePoints: { x: number; y: number; isFuture: boolean }[] = [];

  // First point: (padLeft, baseline)
  linePoints.push({ x: padLeft, y: padTop + plotH, isFuture: false });

  allSteps.forEach((step, i) => {
    const x = padLeft + (i + 1) * stepW;
    const y = padTop + plotH - (step.cumulative / maxCum) * plotH;
    linePoints.push({ x, y, isFuture: step.is_future });
  });

  // Add projection point if projection > last cumulative
  if (projectionAmount > 0) {
    const lastX = linePoints[linePoints.length - 1].x;
    const projX = lastX + stepW;
    const projY = padTop + plotH - (projectionAmount / maxCum) * plotH;
    linePoints.push({ x: projX, y: projY, isFuture: true });
  }

  // Build path strings
  const realLinePoints = linePoints.filter((p) => !p.isFuture || p === linePoints[linePoints.length - 1]);
  const realPathD = realLinePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Future dashed segment
  const futurePoints = linePoints.filter((p) => p.isFuture);
  let futurePathD = "";
  if (futurePoints.length > 0) {
    // Start from the last non-future point
    const lastReal = linePoints.filter((p) => !p.isFuture).pop()!;
    futurePathD = `M ${lastReal.x} ${lastReal.y}`;
    futurePoints.forEach((p) => {
      futurePathD += ` L ${p.x} ${p.y}`;
    });
  }

  return (
    <div class="sav-stair-root">
      {/* Hero Number */}
      <div class="sav-stair-hero">
        <span class="sav-stair-hero-label">AHORRO TOTAL ACUMULADO</span>
        <span class="sav-stair-hero-value">{formatCLP(totalSaved)}</span>
      </div>

      {/* SVG Staircase Chart */}
      <div class="sav-stair-chart-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} class="sav-stair-chart">
          {/* Baseline */}
          <line
            x1={padLeft}
            y1={padTop + plotH}
            x2={padLeft + plotW + stepW}
            y2={padTop + plotH}
            stroke="var(--border-visible)"
            stroke-width="1"
          />

          {/* Bars */}
          {allSteps.map((step, i) => {
            const x = padLeft + i * stepW;
            const barH = (step.cumulative / maxCum) * plotH;
            const y = padTop + plotH - barH;
            const isPending = step.is_current && step.amount === 0;

            return (
              <g key={step.month}>
                {/* The "stair" — a filled rect for cumulative from baseline */}
                <rect
                  x={x}
                  y={y}
                  width={stepW}
                  height={barH}
                  rx="0"
                  fill={step.is_current ? "var(--accent)" : step.is_future ? "var(--surface)" : "var(--surface-raised)"}
                  opacity={step.is_current ? 1 : step.is_future ? 0.6 : 0.9}
                />
                {/* Horizontal step line at top of bar */}
                <line
                  x1={x}
                  y1={y}
                  x2={x + stepW}
                  y2={y}
                  stroke={step.is_current ? "var(--accent)" : "var(--border-visible)"}
                  stroke-width="1.5"
                />
                {/* Vertical dashed within current month if pending */}
                {isPending && (
                  <line
                    x1={x + stepW / 2}
                    y1={padTop + plotH}
                    x2={x + stepW / 2}
                    y2={padTop + plotH - 4}
                    stroke="var(--text-disabled)"
                    stroke-width="1"
                    stroke-dasharray="2 2"
                  />
                )}
                {/* Month label */}
                <text
                  x={x + stepW / 2}
                  y={padTop + plotH + 16}
                  text-anchor="middle"
                  class="sav-stair-bar-label"
                  fill={step.is_current ? "var(--accent)" : step.is_future ? "var(--text-disabled)" : "var(--text-tertiary)"}
                >
                  {step.month}
                </text>
              </g>
            );
          })}

          {/* Staircase connecting line — real past path */}
          <path
            d={realPathD}
            fill="none"
            stroke="var(--text-secondary)"
            stroke-width="1.5"
            stroke-linejoin="round"
            class="sav-stair-line"
          />

          {/* Future projection dashed line */}
          {futurePathD && (
            <path
              d={futurePathD}
              fill="none"
              stroke="var(--text-disabled)"
              stroke-width="1.5"
              stroke-dasharray="5 4"
              stroke-linejoin="round"
              class="sav-stair-line-proj"
            />
          )}

          {/* Dot at each real step top */}
          {realLinePoints.slice(1).filter((p) => !p.isFuture).map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="var(--text-display)"
            />
          ))}
        </svg>
      </div>

      {/* Monthly Detail List */}
      <div class="sav-stair-list">
        <h3 class="sav-stair-list-title">DETALLE MENSUAL</h3>
        {monthlyData.map((step) => {
          const isCurrentPending = step.is_current && step.amount === 0;
          return (
            <div
              key={step.month}
              class={`sav-stair-row ${step.is_current ? "sav-stair-row-current" : ""} ${step.is_future ? "sav-stair-row-future" : ""} ${isCurrentPending ? "sav-stair-row-pending" : ""}`}
            >
              <span class="sav-stair-row-month">{step.month}</span>
              <span class={`sav-stair-row-add ${step.is_future ? "sav-stair-row-add-dim" : ""}`}>
                {step.is_future ? "—" : isCurrentPending ? "PENDIENTE" : `+${formatCLP(step.amount)}`}
              </span>
              <span class={`sav-stair-row-cum ${step.is_future ? "sav-stair-row-cum-dim" : ""}`}>
                {step.is_future ? "—" : formatCLP(step.cumulative)}
              </span>
              {isCurrentPending && onAddEntry && (
                <button class="sav-stair-add-btn" onClick={onAddEntry}>
                  + AÑADIR
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
