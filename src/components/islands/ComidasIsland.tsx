/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";

// ─── Types ───
interface MealType {
  id: string;
  name: string;
  sort_order: number;
}

interface MealPlan {
  id: string;
  meal_date: string;
  meal_type_id: string;
  description: string;
}

interface Props {
  mealTypes: MealType[];
  todaysMeals: Record<string, string>;
  isReadOnly?: boolean;
}

// ─── Helpers ───
const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Meal Labels ───
const MEAL_LABELS: Record<string, string> = {
  Desayuno: "AM",
  Almuerzo: "PM",
  Once: "EVE",
};

// ─── Main Component ───
export default function ComidasIsland({ mealTypes, todaysMeals: initialMeals, isReadOnly }: Props) {
  const [todaysMeals, setTodaysMeals] = useState<Record<string, string>>(initialMeals);

  const handleTodayMealChange = (typeName: string, description: string | null) => {
    setTodaysMeals((prev) => {
      const next = { ...prev };
      if (description) {
        next[typeName] = description;
      } else {
        delete next[typeName];
      }
      return next;
    });
  };

  const now = new Date();
  const hour = now.getHours();
  const todayLabel = now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const filledCount = mealTypes.filter((mt) => todaysMeals[mt.name]).length;
  const currentMeal = hour < 10 ? "Desayuno" : hour < 16 ? "Almuerzo" : "Once";

  return (
    <div class="fh-root">
      <div class="fh-comidas">
        {/* Bento Grid: Today's meals */}
        <div class="bento-header">
          <span class="bento-date">{todayLabel.toUpperCase()}</span>
          <span class="bento-counter">
            <span class="bento-counter-num">{filledCount}</span>
            <span class="bento-counter-sep">/</span>
            <span class="bento-counter-total">{mealTypes.length}</span>
          </span>
        </div>

        <div class="bento-grid">
          {mealTypes.map((mt) => {
            const meal = todaysMeals[mt.name];
            const isCurrent = mt.name === currentMeal;
            const shortLabel = MEAL_LABELS[mt.name] || "";

            return (
              <div
                class={`bento-card ${isCurrent ? "bento-card-active" : ""} ${meal ? "bento-card-filled" : "bento-card-empty"}`}
                key={mt.id}
              >
                <div class="bento-card-top">
                  <span class="bento-meal-type">{mt.name.toUpperCase()}</span>
                  <span class="bento-time-label">{shortLabel}</span>
                </div>
                <div class="bento-card-body">
                  <span class="bento-meal-desc">
                    {meal || "[SIN PLANIFICAR]"}
                  </span>
                </div>
                {isCurrent && (
                  <div class="bento-card-footer">
                    <span class="bento-now-label">AHORA</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Planner */}
        {!isReadOnly && <MealPlannerPanel mealTypes={mealTypes} onTodayMealChange={handleTodayMealChange} />}
      </div>
    </div>
  );
}

// ─── Meal Planner Panel ───
function MealPlannerPanel({ mealTypes, onTodayMealChange }: { mealTypes: MealType[]; onTodayMealChange: (typeName: string, description: string | null) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const mondayStr = formatDateISO(monday);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekLabel = `${monday.getDate()} ${MONTHS_ES[monday.getMonth()]} — ${sunday.getDate()} ${MONTHS_ES[sunday.getMonth()]}`;
  const isCurrentWeek = weekOffset === 0;
  const today = formatDateISO(new Date());

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meals/plan?week_start=${mondayStr}`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data);
      }
    } catch (e) {
      console.error("Failed to fetch meals", e);
    } finally {
      setLoading(false);
    }
  }, [mondayStr]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const getMeal = (date: string, typeId: string) =>
    meals.find((m) => m.meal_date === date && m.meal_type_id === typeId);

  const cellKey = (date: string, typeId: string) => `${date}__${typeId}`;

  const handleCellClick = (date: string, typeId: string) => {
    const existing = getMeal(date, typeId);
    setEditingCell(cellKey(date, typeId));
    setEditingValue(existing?.description || "");
  };

  const handleSave = async (date: string, typeId: string) => {
    const val = editingValue.trim();
    setEditingCell(null);
    const typeName = mealTypes.find((mt) => mt.id === typeId)?.name || "";

    if (!val) {
      const existing = getMeal(date, typeId);
      if (existing) {
        setMeals((prev) => prev.filter((m) => m.id !== existing.id));
        if (date === today && typeName) onTodayMealChange(typeName, null);
        try {
          await fetch("/api/meals/plan", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing.id }),
          });
        } catch {
          setMeals((prev) => [...prev, existing]);
          if (date === today && typeName) onTodayMealChange(typeName, existing.description);
        }
      }
      return;
    }

    const existing = getMeal(date, typeId);
    const tempId = `temp-${Date.now()}`;
    const optimistic: MealPlan = {
      id: existing?.id || tempId,
      meal_date: date,
      meal_type_id: typeId,
      description: val,
    };

    setMeals((prev) => {
      const filtered = prev.filter(
        (m) => !(m.meal_date === date && m.meal_type_id === typeId)
      );
      return [...filtered, optimistic];
    });

    if (date === today && typeName) onTodayMealChange(typeName, val);

    try {
      const res = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_date: date, meal_type_id: typeId, description: val }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id) {
          setMeals((prev) =>
            prev.map((m) =>
              m.id === tempId || (m.meal_date === date && m.meal_type_id === typeId)
                ? { ...m, id: data.id }
                : m
            )
          );
        }
      }
    } catch {
      if (existing) {
        setMeals((prev) => {
          const filtered = prev.filter(
            (m) => !(m.meal_date === date && m.meal_type_id === typeId)
          );
          return [...filtered, existing];
        });
        if (date === today && typeName) onTodayMealChange(typeName, existing.description);
      } else {
        setMeals((prev) => prev.filter((m) => m.id !== tempId));
        if (date === today && typeName) onTodayMealChange(typeName, null);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent, date: string, typeId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave(date, typeId);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  return (
    <div class="mp-container">
      <div class="mp-nav">
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>
          ←
        </button>
        <div class="mp-nav-center">
          <span class="mp-week-label">{weekLabel}</span>
          {isCurrentWeek && <span class="mp-badge">ACTUAL</span>}
        </div>
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>
          →
        </button>
      </div>

      <div class="mp-grid">
        <div class="mp-header-cell mp-corner" />
        {mealTypes.map((mt) => (
          <div class="mp-header-cell" key={mt.id}>
            {mt.name.toUpperCase()}
          </div>
        ))}

        {weekDays.map((day, dayIdx) => {
          const dateStr = formatDateISO(day);
          const isToday = dateStr === today;
          return (
            <>
              <div
                class={`mp-day-cell ${isToday ? "mp-today" : ""}`}
                key={`day-${dayIdx}`}
              >
                <span class="mp-day-name">{DAYS_ES[dayIdx]}</span>
                <span class="mp-day-num">{day.getDate()}</span>
              </div>
              {mealTypes.map((mt) => {
                const key = cellKey(dateStr, mt.id);
                const meal = getMeal(dateStr, mt.id);
                const isEditing = editingCell === key;

                return (
                  <div
                    class={`mp-cell ${isToday ? "mp-cell-today" : ""} ${meal ? "mp-cell-filled" : ""}`}
                    key={key}
                    onClick={() => !isEditing && handleCellClick(dateStr, mt.id)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        class="mp-cell-input"
                        value={editingValue}
                        onInput={(e) =>
                          setEditingValue((e.target as HTMLInputElement).value)
                        }
                        onBlur={() => handleSave(dateStr, mt.id)}
                        onKeyDown={(e) => handleKeyDown(e, dateStr, mt.id)}
                        autoFocus
                        placeholder="¿Qué comerás?"
                      />
                    ) : (
                      <span class="mp-cell-text">{meal?.description || ""}</span>
                    )}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>

      {loading && <div class="mp-loading">CARGANDO...</div>}
    </div>
  );
}
