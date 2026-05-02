/** @jsxImportSource preact */
import { useState, useEffect, useRef, useCallback } from "preact/hooks";

interface WeightLog {
  id: string;
  log_date: string;
  time_of_day: "morning" | "night";
  weight_kg: number;
}

interface Props {
  todayStr: string;
  isReadOnly?: boolean;
}

type ViewRange = "7d" | "30d" | "90d";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
}

function formatKg(n: number): string {
  return n.toFixed(1);
}

export default function WeightIsland({ todayStr, isReadOnly }: Props) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [goal, setGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewRange, setViewRange] = useState<ViewRange>("30d");
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Form state
  const [morningWeight, setMorningWeight] = useState("");
  const [nightWeight, setNightWeight] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  const fetchData = useCallback(async () => {
    const days = viewRange === "7d" ? 7 : viewRange === "90d" ? 90 : 30;
    try {
      const res = await fetch(`/api/weight/log?days=${days}`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
      setGoal(data.goal);
      if (data.goal) setGoalInput(String(data.goal));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [viewRange, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const selectedMorning = logs.find(
      (l) => l.log_date === selectedDate && l.time_of_day === "morning"
    );
    const selectedNight = logs.find(
      (l) => l.log_date === selectedDate && l.time_of_day === "night"
    );
    setMorningWeight(selectedMorning ? String(selectedMorning.weight_kg) : "");
    setNightWeight(selectedNight ? String(selectedNight.weight_kg) : "");
  }, [logs, selectedDate]);

  const saveWeight = async (timeOfDay: "morning" | "night", weightStr: string) => {
    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight < 20 || weight > 300) return;
    setSaving(true);
    try {
      const res = await fetch("/api/weight/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_date: selectedDate, time_of_day: timeOfDay, weight_kg: weight }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    const g = parseFloat(goalInput);
    if (isNaN(g) || g < 20 || g > 300) return;
    setSaving(true);
    try {
      const res = await fetch("/api/weight/log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_goal", goal_kg: g }),
      });
      if (res.ok) {
        setGoal(g);
        setShowGoalForm(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // Compute stats
  const morningLogs = logs.filter((l) => l.time_of_day === "morning");
  const nightLogs = logs.filter((l) => l.time_of_day === "night");
  const latestMorning = morningLogs.length > 0 ? morningLogs[morningLogs.length - 1] : null;
  const latestNight = nightLogs.length > 0 ? nightLogs[nightLogs.length - 1] : null;
  const latestWeight = latestNight || latestMorning;

  // Week change: compare latest morning to morning 7 days ago
  const weekAgoDate = new Date(todayStr + "T12:00:00");
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = weekAgoDate.toISOString().split("T")[0];
  const weekAgoLog = morningLogs.find((l) => l.log_date <= weekAgoStr);
  const weekChange = latestMorning && weekAgoLog ? latestMorning.weight_kg - weekAgoLog.weight_kg : null;

  // Streak: consecutive days with at least one entry
  let streak = 0;
  const dateSet = new Set(logs.map((l) => l.log_date));
  const checkDate = new Date(todayStr + "T12:00:00");
  while (dateSet.has(checkDate.toISOString().split("T")[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Selected date entries
  const selectedMorningEntry = logs.find((l) => l.log_date === selectedDate && l.time_of_day === "morning");
  const selectedNightEntry = logs.find((l) => l.log_date === selectedDate && l.time_of_day === "night");

  if (loading) {
    return (
      <div class="wt-root">
        <div class="wt-skeleton">
          <p class="wt-loading-state">[LOADING...]</p>
        </div>
      </div>
    );
  }

  return (
    <div class="wt-root">
      {/* STATS ROW */}
      <div class="wt-stats">
        <div class="wt-stat">
          <span class="wt-stat-label">ACTUAL</span>
          <span class="wt-stat-value">
            {latestWeight ? `${formatKg(latestWeight.weight_kg)} kg` : "—"}
          </span>
        </div>
        {goal && (
          <div class="wt-stat">
            <span class="wt-stat-label">META</span>
            <span class="wt-stat-value wt-stat-goal">{formatKg(goal)} kg</span>
          </div>
        )}
        {weekChange !== null && (
          <div class="wt-stat">
            <span class="wt-stat-label">7 DÍAS</span>
            <span
              class="wt-stat-value"
              style={{ color: weekChange < 0 ? "var(--success)" : weekChange > 0 ? "var(--accent)" : "var(--text-secondary)" }}
            >
              {weekChange > 0 ? "+" : ""}
              {formatKg(weekChange)} kg
            </span>
          </div>
        )}
        {goal && latestWeight && (
          <div class="wt-stat">
            <span class="wt-stat-label">FALTAN</span>
            <span
              class="wt-stat-value"
              style={{ color: latestWeight.weight_kg <= goal ? "var(--success)" : "var(--text-secondary)" }}
            >
              {latestWeight.weight_kg <= goal
                ? "¡META!"
                : `${formatKg(latestWeight.weight_kg - goal)} kg`}
            </span>
          </div>
        )}
        <div class="wt-stat">
          <span class="wt-stat-label">RACHA</span>
          <span class="wt-stat-value">{streak}d</span>
        </div>
      </div>

      {/* CHART */}
      <div class="wt-chart-section">
        <div class="wt-range-tabs">
          {(["7d", "30d", "90d"] as ViewRange[]).map((r) => (
            <button
              key={r}
              class={`wt-range-tab ${viewRange === r ? "wt-range-tab-active" : ""}`}
              onClick={() => setViewRange(r)}
            >
              {r === "7d" ? "7D" : r === "30d" ? "30D" : "90D"}
            </button>
          ))}
        </div>
        <WeightChart logs={logs} goal={goal} viewRange={viewRange} />
      </div>

      {/* DATE LOG */}
      {!isReadOnly && (
        <div class="wt-log-section">
          <div class="wt-date-header">
            <span class="wt-section-label">
              {selectedDate === todayStr ? "HOY" : "EDITAR DÍA"} — {formatDateFull(selectedDate)}
            </span>
            <input
              type="date"
              class="wt-date-input"
              value={selectedDate}
              max={todayStr}
              onInput={(e) => setSelectedDate((e.target as HTMLInputElement).value || todayStr)}
            />
          </div>
          <div class="wt-log-grid">
            <div class={`wt-log-card ${selectedMorningEntry ? "wt-log-filled" : ""}`}>
              <div class="wt-log-card-header">
                <span class="wt-log-icon">☀</span>
                <span class="wt-log-time">MAÑANA</span>
              </div>
              <div class="wt-log-input-row">
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="00.0"
                  class="wt-log-input"
                  value={morningWeight}
                  onInput={(e) => setMorningWeight((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveWeight("morning", morningWeight);
                  }}
                />
                <span class="wt-log-unit">kg</span>
              </div>
              <button
                class="wt-log-save"
                disabled={saving || !morningWeight}
                onClick={() => saveWeight("morning", morningWeight)}
              >
                {selectedMorningEntry ? "ACTUALIZAR" : "GUARDAR"}
              </button>
            </div>

            <div class={`wt-log-card ${selectedNightEntry ? "wt-log-filled" : ""}`}>
              <div class="wt-log-card-header">
                <span class="wt-log-icon">☾</span>
                <span class="wt-log-time">NOCHE</span>
              </div>
              <div class="wt-log-input-row">
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="00.0"
                  class="wt-log-input"
                  value={nightWeight}
                  onInput={(e) => setNightWeight((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveWeight("night", nightWeight);
                  }}
                />
                <span class="wt-log-unit">kg</span>
              </div>
              <button
                class="wt-log-save"
                disabled={saving || !nightWeight}
                onClick={() => saveWeight("night", nightWeight)}
              >
                {selectedNightEntry ? "ACTUALIZAR" : "GUARDAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOAL */}
      {!isReadOnly && (
        <div class="wt-goal-section">
          {!showGoalForm ? (
            <button class="wt-goal-btn" onClick={() => setShowGoalForm(true)}>
              {goal ? `META: ${formatKg(goal)} KG — CAMBIAR` : "ESTABLECER META"}
            </button>
          ) : (
            <div class="wt-goal-form">
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                placeholder="Meta en kg"
                class="wt-goal-input"
                value={goalInput}
                onInput={(e) => setGoalInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGoal();
                  if (e.key === "Escape") setShowGoalForm(false);
                }}
              />
              <button class="wt-goal-confirm" disabled={saving} onClick={saveGoal}>
                GUARDAR
              </button>
              <button class="wt-goal-cancel" onClick={() => setShowGoalForm(false)}>
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TABLE */}
      <div class="wt-history">
        <span class="wt-section-label">HISTORIAL</span>
        <div class="wt-history-list">
          {logs.length === 0 && <p class="wt-empty">[SIN REGISTROS]</p>}
          {[...new Set(logs.map((l) => l.log_date))]
            .sort((a, b) => b.localeCompare(a))
            .slice(0, 14)
            .map((date) => {
              const morning = logs.find((l) => l.log_date === date && l.time_of_day === "morning");
              const night = logs.find((l) => l.log_date === date && l.time_of_day === "night");
              const isToday = date === todayStr;
              return (
                <div class={`wt-history-row ${isToday ? "wt-history-today" : ""}`} key={date}>
                  <span class="wt-history-date">{formatDate(date)}</span>
                  <div class="wt-history-values">
                    <span class="wt-history-entry">
                      <span class="wt-history-icon">☀</span>
                      {morning ? `${formatKg(morning.weight_kg)}` : "—"}
                    </span>
                    <span class="wt-history-entry">
                      <span class="wt-history-icon">☾</span>
                      {night ? `${formatKg(night.weight_kg)}` : "—"}
                    </span>
                  </div>
                  {morning && night && (
                    <span
                      class="wt-history-diff"
                      style={{
                        color: night.weight_kg - morning.weight_kg > 0
                          ? "var(--text-disabled)"
                          : "var(--success)",
                      }}
                    >
                      {night.weight_kg - morning.weight_kg > 0 ? "+" : ""}
                      {formatKg(night.weight_kg - morning.weight_kg)}
                    </span>
                  )}
                  {!isReadOnly && (
                    <button class="wt-history-edit" onClick={() => setSelectedDate(date)}>
                      EDITAR
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

/* ─── SVG LINE CHART ─── */
function WeightChart({
  logs,
  goal,
  viewRange,
}: {
  logs: WeightLog[];
  goal: number | null;
  viewRange: ViewRange;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const height = 180;
  const pad = { top: 20, right: 12, bottom: 28, left: 40 };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  if (logs.length === 0) {
    return (
      <div class="wt-chart-empty" ref={containerRef}>
        <p class="wt-empty">[SIN DATOS PARA GRAFICAR]</p>
      </div>
    );
  }

  // Get morning points for the chart (prefer morning, fallback to night)
  const dateMap = new Map<string, { morning?: number; night?: number }>();
  logs.forEach((l) => {
    const entry = dateMap.get(l.log_date) || {};
    entry[l.time_of_day] = l.weight_kg;
    dateMap.set(l.log_date, entry);
  });

  const morningPoints: Array<{ date: string; weight: number }> = [];
  const nightPoints: Array<{ date: string; weight: number }> = [];

  const sortedDates = [...dateMap.keys()].sort();
  sortedDates.forEach((date) => {
    const entry = dateMap.get(date)!;
    if (entry.morning !== undefined) morningPoints.push({ date, weight: entry.morning });
    if (entry.night !== undefined) nightPoints.push({ date, weight: entry.night });
  });

  const allWeights = [...morningPoints.map((p) => p.weight), ...nightPoints.map((p) => p.weight)];
  if (goal) allWeights.push(goal);

  const minW = Math.floor(Math.min(...allWeights) - 0.5);
  const maxW = Math.ceil(Math.max(...allWeights) + 0.5);
  const range = maxW - minW || 1;

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const dateToX = (dateStr: string) => {
    const firstDate = new Date(sortedDates[0] + "T12:00:00").getTime();
    const lastDate = new Date(sortedDates[sortedDates.length - 1] + "T12:00:00").getTime();
    const dateMs = new Date(dateStr + "T12:00:00").getTime();
    const span = lastDate - firstDate || 1;
    return pad.left + (((dateMs - firstDate) / span) * chartW);
  };

  const weightToY = (w: number) => {
    return pad.top + chartH - ((w - minW) / range) * chartH;
  };

  const makePath = (points: Array<{ date: string; weight: number }>) => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${dateToX(p.date).toFixed(1)} ${weightToY(p.weight).toFixed(1)}`)
      .join(" ");
  };

  // Y-axis grid lines
  const gridCount = 4;
  const gridStep = range / gridCount;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => minW + i * gridStep);

  // X-axis labels: show a subset of dates
  const maxLabels = viewRange === "7d" ? 7 : viewRange === "30d" ? 6 : 5;
  const labelStep = Math.max(1, Math.floor(sortedDates.length / maxLabels));
  const xLabels = sortedDates.filter((_, i) => i % labelStep === 0 || i === sortedDates.length - 1);

  return (
    <div class="wt-chart-wrap" ref={containerRef}>
      <svg width={width} height={height} class="wt-chart-svg">
        {/* Grid lines */}
        {gridLines.map((w) => (
          <g key={w}>
            <line
              x1={pad.left}
              y1={weightToY(w)}
              x2={width - pad.right}
              y2={weightToY(w)}
              stroke="var(--border)"
              stroke-dasharray="2,3"
            />
            <text
              x={pad.left - 6}
              y={weightToY(w) + 3}
              text-anchor="end"
              fill="var(--text-disabled)"
              font-size="9"
              font-family="var(--font-mono)"
            >
              {w.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Goal line */}
        {goal && (
          <g>
            <line
              x1={pad.left}
              y1={weightToY(goal)}
              x2={width - pad.right}
              y2={weightToY(goal)}
              stroke="var(--success)"
              stroke-dasharray="4,4"
              opacity="0.6"
            />
            <text
              x={width - pad.right + 2}
              y={weightToY(goal) + 3}
              fill="var(--success)"
              font-size="8"
              font-family="var(--font-mono)"
              opacity="0.8"
            >
              META
            </text>
          </g>
        )}

        {/* Morning line */}
        {morningPoints.length > 1 && (
          <path d={makePath(morningPoints)} fill="none" stroke="var(--text-display)" stroke-width="1.5" />
        )}
        {morningPoints.map((p) => (
          <circle
            key={`m-${p.date}`}
            cx={dateToX(p.date)}
            cy={weightToY(p.weight)}
            r={3}
            fill="var(--text-display)"
          />
        ))}

        {/* Night line */}
        {nightPoints.length > 1 && (
          <path d={makePath(nightPoints)} fill="none" stroke="var(--text-disabled)" stroke-width="1" stroke-dasharray="3,2" />
        )}
        {nightPoints.map((p) => (
          <circle
            key={`n-${p.date}`}
            cx={dateToX(p.date)}
            cy={weightToY(p.weight)}
            r={2}
            fill="var(--text-disabled)"
          />
        ))}

        {/* X labels */}
        {xLabels.map((date) => (
          <text
            key={date}
            x={dateToX(date)}
            y={height - 4}
            text-anchor="middle"
            fill="var(--text-disabled)"
            font-size="9"
            font-family="var(--font-mono)"
          >
            {formatDate(date)}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div class="wt-chart-legend">
        <span class="wt-legend-item">
          <span class="wt-legend-dot" style={{ background: "var(--text-display)" }} />
          MAÑANA
        </span>
        <span class="wt-legend-item">
          <span class="wt-legend-dot wt-legend-dot-hollow" />
          NOCHE
        </span>
        {goal && (
          <span class="wt-legend-item">
            <span class="wt-legend-line" />
            META
          </span>
        )}
      </div>
    </div>
  );
}
