/** @jsxImportSource preact */

interface CategorySlice {
  category: string;
  total: number;
  color: string;
  pct: number;
}

interface Props {
  categories: CategorySlice[];
  total: number;
  size?: number;
}

export default function CategoryDonut({ categories, total, size = 180 }: Props) {
  const center = size / 2;
  const radius = (size - 20) / 2;
  const strokeWidth = 24;
  const innerRadius = radius - strokeWidth;
  const circumference = 2 * Math.PI * innerRadius;

  let offset = 0;
  const slices = categories.map((cat) => {
    const dashLength = (cat.pct / 100) * circumference;
    const slice = { ...cat, dashLength, dashOffset: offset };
    offset += dashLength;
    return slice;
  });

  // Rotate to start from top
  const transform = `rotate(-90 ${center} ${center})`;

  return (
    <div class="donut-container">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <g transform={transform}>
          {slices.map((s) => (
            <circle
              key={s.category}
              cx={center}
              cy={center}
              r={innerRadius}
              fill="none"
              stroke={s.color}
              stroke-width={strokeWidth}
              stroke-dasharray={`${s.dashLength} ${circumference - s.dashLength}`}
              stroke-dashoffset={-s.dashOffset}
              stroke-linecap="butt"
              class="donut-slice"
            >
              <title>{s.category}: {formatCLP(s.total)} ({s.pct}%)</title>
            </circle>
          ))}
          {/* Center text */}
        </g>
        <text x={center} y={center - 8} text-anchor="middle" class="donut-total">
          {formatCLP(total)}
        </text>
        <text x={center} y={center + 14} text-anchor="middle" class="donut-label">
          TOTAL
        </text>
      </svg>

      {/* Legend */}
      <div class="donut-legend">
        {categories.filter(c => c.total > 0).map((c) => (
          <div key={c.category} class="donut-legend-item">
            <span class="donut-legend-dot" style={{ background: c.color }} />
            <span class="donut-legend-name">{c.category}</span>
            <span class="donut-legend-pct">{c.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}
