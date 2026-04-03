/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";

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
  meal_types: { name: string; sort_order: number };
  profiles: { display_name: string };
}

interface Props {
  mealTypes: MealType[];
}

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function MealPlanner({ mealTypes }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(monday);
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

  const getMeal = (date: string, mealTypeId: string): MealPlan | undefined => {
    return meals.find(
      (m) => m.meal_date === date && m.meal_type_id === mealTypeId
    );
  };

  const cellKey = (date: string, typeId: string) => `${date}__${typeId}`;

  const handleCellClick = (date: string, typeId: string) => {
    const key = cellKey(date, typeId);
    const existing = getMeal(date, typeId);
    setEditingCell(key);
    setEditingValue(existing?.description || "");
  };

  const handleSave = async (date: string, typeId: string) => {
    const val = editingValue.trim();
    setEditingCell(null);

    if (!val) {
      // Delete if exists
      const existing = getMeal(date, typeId);
      if (existing) {
        // Optimistic delete
        setMeals((prev) => prev.filter((m) => m.id !== existing.id));
        try {
          await fetch("/api/meals/plan", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing.id }),
          });
        } catch (e) {
          console.error(e);
          // Rollback on error
          setMeals((prev) => [...prev, existing]);
        }
      }
      return;
    }

    const existing = getMeal(date, typeId);
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMeal: MealPlan = {
      id: existing?.id || tempId,
      meal_date: date,
      meal_type_id: typeId,
      description: val,
      meal_types: mealTypes.find((mt) => mt.id === typeId)
        ? { name: mealTypes.find((mt) => mt.id === typeId)!.name, sort_order: mealTypes.find((mt) => mt.id === typeId)!.sort_order }
        : { name: "", sort_order: 0 },
      profiles: { display_name: "" },
    };

    setMeals((prev) => {
      const filtered = prev.filter(
        (m) => !(m.meal_date === date && m.meal_type_id === typeId)
      );
      return [...filtered, optimisticMeal];
    });

    try {
      const res = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_date: date,
          meal_type_id: typeId,
          description: val,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update temp ID with real ID
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
    } catch (e) {
      console.error(e);
      // Rollback: restore previous state
      if (existing) {
        setMeals((prev) => {
          const filtered = prev.filter(
            (m) => !(m.meal_date === date && m.meal_type_id === typeId)
          );
          return [...filtered, existing];
        });
      } else {
        setMeals((prev) => prev.filter((m) => m.id !== tempId));
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
      {/* Week navigation */}
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

      {/* Grid */}
      <div class="mp-grid">
        {/* Header row */}
        <div class="mp-header-cell mp-corner"></div>
        {mealTypes.map((mt) => (
          <div class="mp-header-cell" key={mt.id}>
            {mt.name.toUpperCase()}
          </div>
        ))}

        {/* Day rows */}
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
                    class={`mp-cell ${isToday ? "mp-cell-today" : ""} ${
                      meal ? "mp-cell-filled" : ""
                    }`}
                    key={key}
                    onClick={() => !isEditing && handleCellClick(dateStr, mt.id)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        class="mp-cell-input"
                        value={editingValue}
                        onInput={(e) =>
                          setEditingValue(
                            (e.target as HTMLInputElement).value
                          )
                        }
                        onBlur={() => handleSave(dateStr, mt.id)}
                        onKeyDown={(e) => handleKeyDown(e, dateStr, mt.id)}
                        autoFocus
                        placeholder="¿Qué comerás?"
                      />
                    ) : (
                      <span class="mp-cell-text">
                        {meal?.description || ""}
                      </span>
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
