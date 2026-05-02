export type MealIngredientSource = "available" | "missing" | "suggested";

export interface MealSuggestionIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  source: MealIngredientSource;
  estimated_calories?: number | null;
}

export interface MealShoppingItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface MealSuggestion {
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

export interface MealSuggestionResponse {
  suggestions: MealSuggestion[];
}

export const mealSuggestionResponseSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          meal_type: { type: "string" },
          servings: { type: "integer" },
          calories_per_serving: { type: "integer" },
          protein_g: { type: "number", nullable: true },
          carbs_g: { type: "number", nullable: true },
          fat_g: { type: "number", nullable: true },
          health_note: { type: "string" },
          ingredients: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number", nullable: true },
                unit: { type: "string", nullable: true },
                source: { type: "string", enum: ["available", "missing", "suggested"] },
                estimated_calories: { type: "integer", nullable: true },
              },
              required: ["name", "quantity", "unit", "source"],
            },
          },
          steps: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          shopping_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number", nullable: true },
                unit: { type: "string", nullable: true },
              },
              required: ["name", "quantity", "unit"],
            },
          },
        },
        required: [
          "title",
          "meal_type",
          "servings",
          "calories_per_serving",
          "protein_g",
          "carbs_g",
          "fat_g",
          "health_note",
          "ingredients",
          "steps",
          "shopping_items",
        ],
      },
    },
  },
  required: ["suggestions"],
} as const;

export function parseMealSuggestionResponse(value: unknown): MealSuggestionResponse {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error("La IA no devolvió sugerencias válidas");
  }

  const suggestions = value.suggestions
    .map(parseMealSuggestion)
    .filter((suggestion): suggestion is MealSuggestion => suggestion !== null)
    .slice(0, 4);

  if (suggestions.length === 0) {
    throw new Error("La IA no devolvió recetas utilizables");
  }

  return { suggestions };
}

function parseMealSuggestion(value: unknown): MealSuggestion | null {
  if (!isRecord(value)) return null;

  const title = toCleanString(value.title);
  const mealType = toCleanString(value.meal_type);
  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map(parseIngredient).filter((item): item is MealSuggestionIngredient => item !== null)
    : [];
  const steps = Array.isArray(value.steps)
    ? value.steps.map(toCleanString).filter(Boolean).slice(0, 8)
    : [];
  const shoppingItems = Array.isArray(value.shopping_items)
    ? value.shopping_items.map(parseShoppingItem).filter((item): item is MealShoppingItem => item !== null)
    : [];

  if (!title || !mealType || ingredients.length === 0 || steps.length === 0) return null;

  const suggestion: MealSuggestion = {
    title,
    meal_type: mealType,
    servings: Math.max(1, Math.round(toNumber(value.servings) || 1)),
    calories_per_serving: Math.round(toNumber(value.calories_per_serving) || 0),
    protein_g: nullableNonNegativeNumber(value.protein_g),
    carbs_g: nullableNonNegativeNumber(value.carbs_g),
    fat_g: nullableNonNegativeNumber(value.fat_g),
    health_note: toCleanString(value.health_note) || "Estimación saludable basada en los productos disponibles.",
    ingredients,
    steps,
    shopping_items: shoppingItems,
  };

  validateNutrition(suggestion);
  return suggestion;
}

function parseIngredient(value: unknown): MealSuggestionIngredient | null {
  if (!isRecord(value)) return null;
  const name = toCleanString(value.name);
  const source = value.source === "available" || value.source === "missing" || value.source === "suggested"
    ? value.source
    : null;
  if (!name || !source) return null;

  return {
    name,
    quantity: nullablePositiveNumber(value.quantity),
    unit: toCleanString(value.unit) || null,
    source,
    estimated_calories: nullableNonNegativeNumber(value.estimated_calories),
  };
}

function parseShoppingItem(value: unknown): MealShoppingItem | null {
  if (!isRecord(value)) return null;
  const name = toCleanString(value.name);
  if (!name) return null;
  return {
    name,
    quantity: nullablePositiveNumber(value.quantity),
    unit: toCleanString(value.unit) || null,
  };
}

function validateNutrition(suggestion: MealSuggestion): void {
  const calories = suggestion.calories_per_serving;
  if (!Number.isFinite(calories) || calories < 80 || calories > 1200) {
    throw new Error(`Calorias fuera de rango para ${suggestion.title}`);
  }

  const macros = [suggestion.protein_g, suggestion.carbs_g, suggestion.fat_g];
  if (macros.every((value) => value === null || value <= 0)) {
    throw new Error(`Macros incompletos para ${suggestion.title}`);
  }

  for (const value of macros) {
    if (value !== null && value > 220) {
      throw new Error(`Macro fuera de rango para ${suggestion.title}`);
    }
  }

  if (suggestion.protein_g !== null && suggestion.carbs_g !== null && suggestion.fat_g !== null) {
    const macroCalories = suggestion.protein_g * 4 + suggestion.carbs_g * 4 + suggestion.fat_g * 9;
    if (macroCalories > 0) {
      const difference = Math.abs(calories - macroCalories);
      const ratio = difference / Math.max(calories, macroCalories);
      if (difference > 250 && ratio > 0.45) {
        throw new Error(`Calorias y macros no coinciden para ${suggestion.title}`);
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableNonNegativeNumber(value: unknown): number | null {
  const numberValue = toNumber(value);
  return numberValue === null || numberValue < 0 ? null : numberValue;
}

function nullablePositiveNumber(value: unknown): number | null {
  const numberValue = toNumber(value);
  return numberValue === null || numberValue <= 0 ? null : numberValue;
}