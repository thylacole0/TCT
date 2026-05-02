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

interface MealSuggestionIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  source: "available" | "missing" | "suggested";
  estimated_calories?: number | null;
}

interface MealShoppingItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

interface MealSuggestion {
  title: string;
  meal_type: string;
  servings: number;
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  health_note: string;
  ingredients: MealSuggestionIngredient[];
  steps: string[];
  shopping_items: MealShoppingItem[];
}

interface SavedRecipe {
  id: string;
  title: string;
  description: string | null;
  meal_type_id: string | null;
  servings: number;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  health_note: string | null;
  instructions: string[] | null;
  created_by?: string;
  can_delete?: boolean;
  recipe_ingredients?: MealSuggestionIngredient[];
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

const AI_PREFS_STORAGE_KEY = "tct-ai-meal-preferences";

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
  const today = formatDateISO(now);
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
        {!isReadOnly && (
          <AiMealSuggestionPanel
            mealTypes={mealTypes}
            today={today}
            currentMeal={currentMeal}
            onTodayMealChange={handleTodayMealChange}
          />
        )}
        {!isReadOnly && <MealPlannerPanel mealTypes={mealTypes} onTodayMealChange={handleTodayMealChange} />}
      </div>
    </div>
  );
}

// ─── AI Meal Suggestions ───
function AiMealSuggestionPanel({
  mealTypes,
  today,
  currentMeal,
  onTodayMealChange,
}: {
  mealTypes: MealType[];
  today: string;
  currentMeal: string;
  onTodayMealChange: (typeName: string, description: string | null) => void;
}) {
  const currentMealType = mealTypes.find((type) => type.name === currentMeal) || mealTypes[0];
  const [mealTypeId, setMealTypeId] = useState(currentMealType?.id || "");
  const [mealDate, setMealDate] = useState(today);
  const [people, setPeople] = useState(2);
  const [maxCalories, setMaxCalories] = useState("");
  const [avoidText, setAvoidText] = useState("");
  const [preferText, setPreferText] = useState("");
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingPlanSuggestion, setPendingPlanSuggestion] = useState<MealSuggestion | null>(null);
  const [pendingPlanMealTypeId, setPendingPlanMealTypeId] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planning, setPlanning] = useState(false);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    if (!mealTypeId && currentMealType?.id) setMealTypeId(currentMealType.id);
  }, [currentMealType?.id, mealTypeId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_PREFS_STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.preferText === "string") setPreferText(prefs.preferText);
      if (typeof prefs.avoidText === "string") setAvoidText(prefs.avoidText);
      if (typeof prefs.maxCalories === "string") setMaxCalories(prefs.maxCalories);
      if (typeof prefs.people === "number") setPeople(Math.max(1, Math.min(8, Math.round(prefs.people))));
    } catch {
      localStorage.removeItem(AI_PREFS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(AI_PREFS_STORAGE_KEY, JSON.stringify({ preferText, avoidText, maxCalories, people }));
  }, [preferText, avoidText, maxCalories, people]);

  const fetchSavedRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    try {
      const res = await fetch("/api/recipes/list");
      if (res.ok) setSavedRecipes(await res.json());
    } catch (err) {
      console.error("No se pudieron cargar recetas", err);
    } finally {
      setLoadingRecipes(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedRecipes();
  }, [fetchSavedRecipes]);

  const selectedMeal = mealTypes.find((type) => type.id === mealTypeId);
  const pendingPlanMeal = mealTypes.find((type) => type.id === pendingPlanMealTypeId) || selectedMeal;

  const generateSuggestions = async () => {
    if (!mealTypeId) return;
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/ai/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_date: mealDate,
          meal_type_id: mealTypeId,
          people,
          preferences: {
            healthy: true,
            max_calories_per_serving: maxCalories ? Number(maxCalories) : null,
            avoid: splitPreferenceText(avoidText),
            prefer: splitPreferenceText(preferText),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar");
      setSuggestions(data.suggestions || []);
      setGenerationId(data.ai_generation_id || null);
    } catch (err: any) {
      setError(err.message || "No se pudo generar sugerencias");
    } finally {
      setLoading(false);
    }
  };

  const openPlanSuggestion = (suggestion: MealSuggestion, targetMealTypeId = mealTypeId) => {
    setPendingPlanSuggestion(suggestion);
    setPendingPlanMealTypeId(targetMealTypeId);
    setPlanDescription(buildSuggestionPlanDescription(suggestion));
    setNotice("");
    setError("");
  };

  const useInPlan = async () => {
    const suggestion = pendingPlanSuggestion;
    if (!pendingPlanMeal) return;
    if (!suggestion) return;
    const description = planDescription.trim() || buildSuggestionPlanDescription(suggestion);
    setNotice("");
    setError("");
    setPlanning(true);

    try {
      const res = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_date: mealDate,
          meal_type_id: pendingPlanMeal.id,
          description,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (mealDate === today) onTodayMealChange(pendingPlanMeal.name, description);
      setNotice(`${pendingPlanMeal.name} agregada al calendario`);
      setPendingPlanSuggestion(null);
    } catch (err: any) {
      setError(err.message || "No se pudo planificar");
    } finally {
      setPlanning(false);
    }
  };

  const saveRecipe = async (suggestion: MealSuggestion) => {
    setNotice("");
    setError("");

    try {
      const res = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_type_id: mealTypeId,
          ai_generation_id: generationId,
          suggestion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la receta");
      setNotice(data.existing ? "La receta ya estaba guardada" : "Receta guardada");
      fetchSavedRecipes();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la receta");
    }
  };

  const addMissingToList = async (suggestion: MealSuggestion, sourceRecipeId?: string | null) => {
    const missing = suggestion.shopping_items.length > 0
      ? suggestion.shopping_items
      : suggestion.ingredients
          .filter((ingredient) => ingredient.source === "missing")
          .map((ingredient) => ({ name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit }));

    if (missing.length === 0) {
      setNotice("Esta receta no tiene faltantes");
      return;
    }

    setNotice("");
    setError("");

    try {
      await Promise.all(missing.map((item) => fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          list_type: "comida",
          quantity: Math.max(1, Math.ceil(Number(item.quantity) || 1)),
          unit: item.unit,
          source_recipe_id: sourceRecipeId || null,
          notes: `Receta IA: ${suggestion.title}`,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
      })));
      setNotice("Faltantes agregados a la lista de comida");
    } catch (err: any) {
      setError(err.message || "No se pudieron agregar faltantes");
    }
  };

  const deleteRecipe = async (recipe: SavedRecipe) => {
    if (!confirm(`Quitar receta guardada: ${recipe.title}?`)) return;
    setDeletingRecipeId(recipe.id);
    setNotice("");
    setError("");

    try {
      const res = await fetch("/api/recipes/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recipe.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
      setNotice("Receta eliminada");
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar la receta");
    } finally {
      setDeletingRecipeId(null);
    }
  };

  if (mealTypes.length === 0) return null;

  return (
    <div class="ai-meal-panel">
      <div class="ai-meal-header">
        <div>
          <span class="fh-label">SUGERENCIAS CON IA</span>
          <p class="ai-meal-copy">Usa compras recientes y lista pendiente para proponer comidas sanas con macros estimados por porción.</p>
        </div>
        <button class="ai-meal-generate" type="button" onClick={generateSuggestions} disabled={loading || !mealTypeId}>
          {loading ? "GENERANDO..." : "SUGERIR"}
        </button>
      </div>

      <div class="ai-meal-controls">
        <label class="ai-field ai-field-select">
          <span>Comida</span>
          <select class="ai-meal-select" value={mealTypeId} onInput={(event) => setMealTypeId((event.target as HTMLSelectElement).value)}>
            {mealTypes.map((type) => <option value={type.id}>{type.name}</option>)}
          </select>
        </label>
        <label class="ai-field">
          <span>Fecha</span>
          <input class="ai-meal-input" type="date" value={mealDate} onInput={(event) => setMealDate((event.target as HTMLInputElement).value || today)} />
        </label>
        <label class="ai-field">
          <span>Personas</span>
          <input class="ai-meal-input" type="number" min={1} max={8} value={people} onInput={(event) => setPeople(Math.max(1, Math.min(8, Number((event.target as HTMLInputElement).value) || 2)))} />
        </label>
        <label class="ai-field">
          <span>Kcal max</span>
          <input class="ai-meal-input" type="number" min={100} placeholder="Opcional" value={maxCalories} onInput={(event) => setMaxCalories((event.target as HTMLInputElement).value)} />
        </label>
      </div>

      <div class="ai-meal-preferences">
        <label class="ai-field">
          <span>Preferir</span>
          <input class="ai-meal-pref" type="text" placeholder="pollo, huevos, verduras..." value={preferText} onInput={(event) => setPreferText((event.target as HTMLInputElement).value)} />
        </label>
        <label class="ai-field">
          <span>Evitar</span>
          <input class="ai-meal-pref" type="text" placeholder="frituras, lactosa, pan..." value={avoidText} onInput={(event) => setAvoidText((event.target as HTMLInputElement).value)} />
        </label>
      </div>

      {error && <p class="ai-meal-error">[ERROR: {error}]</p>}
      {notice && <p class="ai-meal-notice">{notice}</p>}

      {suggestions.length > 0 && (
        <div class="ai-meal-results">
          {suggestions.map((suggestion) => (
            <div class="ai-meal-card" key={suggestion.title}>
              <div class="ai-meal-card-top">
                <div>
                  <span class="ai-meal-title">{suggestion.title}</span>
                  <span class="ai-meal-meta">{suggestion.servings} porciones · cantidades totales para la receta</span>
                </div>
                <span class="ai-meal-type">{suggestion.meal_type.toUpperCase()}</span>
              </div>

              <p class="ai-meal-health">{suggestion.health_note}</p>

              <div class="ai-meal-macros">
                <span><strong>{suggestion.calories_per_serving}</strong><small>kcal/porción</small></span>
                <span><strong>{formatMacro(suggestion.protein_g)}</strong><small>proteína g/porción</small></span>
                <span><strong>{formatMacro(suggestion.carbs_g)}</strong><small>carbos g/porción</small></span>
                <span><strong>{formatMacro(suggestion.fat_g)}</strong><small>grasas g/porción</small></span>
              </div>

              <div class="ai-ingredients">
                {suggestion.ingredients.map((ingredient) => (
                  <span class={`ai-ingredient ai-ingredient-${ingredient.source}`} key={`${suggestion.title}-${ingredient.name}-${ingredient.source}`}>
                    {ingredient.name}{formatIngredientAmount(ingredient)}
                  </span>
                ))}
              </div>

              <ol class="ai-steps">
                {suggestion.steps.slice(0, 4).map((step) => <li>{step}</li>)}
              </ol>

              <div class="ai-meal-actions">
                <button class="ai-action-primary" type="button" onClick={() => openPlanSuggestion(suggestion)}>AGENDAR</button>
                <button type="button" onClick={() => saveRecipe(suggestion)}>GUARDAR RECETA</button>
                <button type="button" onClick={() => addMissingToList(suggestion)}>FALTANTES A LISTA</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(loadingRecipes || savedRecipes.length > 0) && (
        <div class="ai-saved-recipes">
          <div class="ai-saved-header">
            <span class="fh-label">RECETAS GUARDADAS</span>
            <span class="fh-caption">{loadingRecipes ? "CARGANDO" : `${savedRecipes.length} DISPONIBLES`}</span>
          </div>
          <div class="ai-saved-list">
            {savedRecipes.slice(0, 6).map((recipe) => {
              const recipeMeal = mealTypes.find((type) => type.id === recipe.meal_type_id) || selectedMeal;
              const suggestion = recipeToSuggestion(recipe, recipeMeal?.name || "Comida");
              return (
                <div class="ai-saved-item" key={recipe.id}>
                  <div>
                    <span class="ai-saved-title">{recipe.title}</span>
                    <span class="ai-saved-meta">
                      {recipeMeal?.name || "Comida"} · {recipe.calories_per_serving || "--"} kcal/porción · proteína {formatMacro(recipe.protein_g)} g
                    </span>
                  </div>
                  <button type="button" onClick={() => openPlanSuggestion(suggestion, recipeMeal?.id || mealTypeId)}>
                    AGENDAR
                  </button>
                  <button type="button" onClick={() => addMissingToList(suggestion, recipe.id)}>
                    FALTANTES
                  </button>
                  {recipe.can_delete && (
                    <button type="button" onClick={() => deleteRecipe(recipe)} disabled={deletingRecipeId === recipe.id}>
                      {deletingRecipeId === recipe.id ? "..." : "QUITAR"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingPlanSuggestion && pendingPlanMeal && (
        <div class="meal-modal-backdrop" role="presentation" onClick={() => !planning && setPendingPlanSuggestion(null)}>
          <div class="meal-modal" role="dialog" aria-modal="true" aria-label="Agendar sugerencia" onClick={(event) => event.stopPropagation()}>
            <div class="meal-modal-header">
              <div>
                <span class="meal-modal-kicker">AGENDAR RECETA</span>
                <h3>{pendingPlanMeal.name} · {formatDisplayDate(mealDate)}</h3>
              </div>
              <button class="meal-modal-close" type="button" onClick={() => setPendingPlanSuggestion(null)} disabled={planning}>[ X ]</button>
            </div>
            <p class="meal-modal-copy">Ajusta el texto que quedará en el calendario.</p>
            <textarea
              class="meal-modal-textarea"
              value={planDescription}
              onInput={(event) => setPlanDescription((event.target as HTMLTextAreaElement).value)}
              rows={4}
              autoFocus
            />
            <div class="meal-modal-actions">
              <button type="button" onClick={() => setPendingPlanSuggestion(null)} disabled={planning}>CANCELAR</button>
              <button class="meal-modal-primary" type="button" onClick={useInPlan} disabled={planning || !planDescription.trim()}>
                {planning ? "AGENDANDO..." : "AGENDAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function splitPreferenceText(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatMacro(value: number | null): string {
  return value === null ? "--" : String(Math.round(value));
}

function formatIngredientAmount(ingredient: MealSuggestionIngredient): string {
  if (!ingredient.quantity) return "";
  return ` · ${formatQuantity(ingredient.quantity)}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function buildSuggestionPlanDescription(suggestion: MealSuggestion): string {
  const protein = suggestion.protein_g === null ? "proteina s/d" : `proteina ${Math.round(suggestion.protein_g)} g`;
  return `${suggestion.title} · ${suggestion.calories_per_serving} kcal/porcion · ${protein}`;
}

function recipeToSuggestion(recipe: SavedRecipe, mealTypeName: string): MealSuggestion {
  const ingredients = Array.isArray(recipe.recipe_ingredients) ? recipe.recipe_ingredients : [];
  return {
    title: recipe.title,
    meal_type: mealTypeName,
    servings: Math.max(1, Number(recipe.servings) || 1),
    calories_per_serving: Math.max(1, Number(recipe.calories_per_serving) || 1),
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    health_note: recipe.health_note || recipe.description || "Receta guardada en TCT.",
    ingredients,
    steps: Array.isArray(recipe.instructions) ? recipe.instructions : [],
    shopping_items: ingredients
      .filter((ingredient) => ingredient.source === "missing")
      .map((ingredient) => ({ name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit })),
  };
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Meal Planner Panel ───
function MealPlannerPanel({ mealTypes, onTodayMealChange }: { mealTypes: MealType[]; onTodayMealChange: (typeName: string, description: string | null) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{ date: string; typeId: string } | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

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

  const openMealEditor = (date: string, typeId: string) => {
    const existing = getMeal(date, typeId);
    setEditor({ date, typeId });
    setEditorValue(existing?.description || "");
    setEditorError("");
  };

  const closeMealEditor = () => {
    if (editorSaving) return;
    setEditor(null);
    setEditorValue("");
    setEditorError("");
  };

  const saveMeal = async (date: string, typeId: string, value: string) => {
    const val = value.trim();
    const typeName = mealTypes.find((mt) => mt.id === typeId)?.name || "";
    setEditorSaving(true);
    setEditorError("");

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
          setEditorError("No se pudo quitar la comida");
          setEditorSaving(false);
          return;
        }
      }
      setEditorSaving(false);
      closeMealEditor();
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
      } else {
        throw new Error(await res.text());
      }
      setEditorSaving(false);
      closeMealEditor();
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
      setEditorError("No se pudo guardar la comida");
      setEditorSaving(false);
    }
  };

  const handleCellKeyDown = (e: KeyboardEvent, date: string, typeId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMealEditor(date, typeId);
    }
  };

  const activeMealType = editor ? mealTypes.find((mt) => mt.id === editor.typeId) : null;
  const activeMeal = editor ? getMeal(editor.date, editor.typeId) : null;

  return (
    <div class="mp-container">
      <div class="mp-nav">
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>
          {"<"}
        </button>
        <div class="mp-nav-center">
          <span class="mp-week-label">{weekLabel}</span>
          {isCurrentWeek && <span class="mp-badge">ACTUAL</span>}
        </div>
        <button class="mp-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>
          {">"}
        </button>
      </div>

      {loading && <p class="mp-inline-status">[LOADING...]</p>}

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
                const key = `${dateStr}__${mt.id}`;
                const meal = getMeal(dateStr, mt.id);

                return (
                  <button
                    type="button"
                    class={`mp-cell ${isToday ? "mp-cell-today" : ""} ${meal ? "mp-cell-filled" : ""}`}
                    key={key}
                    onClick={() => openMealEditor(dateStr, mt.id)}
                    onKeyDown={(event) => handleCellKeyDown(event, dateStr, mt.id)}
                    aria-label={`${mt.name} ${formatDisplayDate(dateStr)} ${meal?.description || "sin planificar"}`}
                  >
                    <span class="mp-cell-text">{meal?.description || "Tocar para planificar"}</span>
                  </button>
                );
              })}
            </>
          );
        })}
      </div>

      {editor && activeMealType && (
        <div class="meal-modal-backdrop" role="presentation" onClick={closeMealEditor}>
          <div class="meal-modal" role="dialog" aria-modal="true" aria-label="Editar comida del calendario" onClick={(event) => event.stopPropagation()}>
            <div class="meal-modal-header">
              <div>
                <span class="meal-modal-kicker">CALENDARIO</span>
                <h3>{activeMealType.name} · {formatDisplayDate(editor.date)}</h3>
              </div>
              <button class="meal-modal-close" type="button" onClick={closeMealEditor} disabled={editorSaving}>[ X ]</button>
            </div>
            <p class="meal-modal-copy">Escribe lo que quieras dejar planificado para esta casilla.</p>
            <textarea
              class="meal-modal-textarea"
              value={editorValue}
              onInput={(event) => setEditorValue((event.target as HTMLTextAreaElement).value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") saveMeal(editor.date, editor.typeId, editorValue);
                if (event.key === "Escape") closeMealEditor();
              }}
              rows={5}
              autoFocus
              placeholder="Ej: Pollo con arroz y ensalada"
            />
            {editorError && <p class="meal-modal-error">{editorError}</p>}
            <div class="meal-modal-actions">
              {activeMeal && (
                <button class="meal-modal-danger" type="button" onClick={() => saveMeal(editor.date, editor.typeId, "")} disabled={editorSaving}>
                  QUITAR
                </button>
              )}
              <button type="button" onClick={closeMealEditor} disabled={editorSaving}>CANCELAR</button>
              <button class="meal-modal-primary" type="button" onClick={() => saveMeal(editor.date, editor.typeId, editorValue)} disabled={editorSaving || !editorValue.trim()}>
                {editorSaving ? "GUARDANDO..." : "GUARDAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
