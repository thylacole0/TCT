import { formatDateCL, getMondayChile } from "../dates";
import { displayFoodName, isLikelyFoodProduct, normalizeFoodName } from "./normalization";

type SupabaseLike = any;

export interface MealSuggestionPreferences {
  healthy: boolean;
  max_calories_per_serving: number | null;
  avoid: string[];
  prefer: string[];
}

export interface MealSuggestionContext {
  meal: {
    date: string;
    type_id: string;
    type_name: string;
    people: number;
  };
  preferences: MealSuggestionPreferences;
  available_items: Array<{
    name: string;
    normalized_name: string;
    bought_count: number;
    quantity_total: number;
    latest_date: string;
    estimated_spent: number;
  }>;
  pending_shopping_items: Array<{
    name: string;
    quantity: number;
  }>;
  planned_meals_this_week: Array<{
    date: string;
    meal_type: string;
    description: string;
  }>;
  recent_recipes: Array<{
    title: string;
    calories_per_serving: number | null;
  }>;
  budget: {
    week_start: string;
    budget_amount: number;
    spent_so_far: number;
    remaining: number;
  };
  excluded_likely_non_food: string[];
}

export async function buildMealSuggestionContext(
  supabase: SupabaseLike,
  options: {
    mealDate: string;
    mealTypeId: string;
    people: number;
    preferences: MealSuggestionPreferences;
  }
): Promise<MealSuggestionContext> {
  const mealType = await fetchMealType(supabase, options.mealTypeId);
  const mealDate = new Date(`${options.mealDate}T12:00:00`);
  const since = new Date(mealDate);
  since.setDate(since.getDate() - 21);
  const sinceStr = formatDateCL(since);

  const monday = getMondayChile(mealDate);
  const weekStart = formatDateCL(monday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekEnd = formatDateCL(sunday);

  const [expensesRes, shoppingRes, mealsRes, budgetRes, recipesRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, expense_date, amount, category, budget_type")
      .eq("budget_type", "comida")
      .gte("expense_date", sinceStr)
      .lte("expense_date", options.mealDate)
      .order("expense_date", { ascending: false })
      .limit(80),
    supabase
      .from("shopping_list_items")
      .select("id, name, quantity, is_bought, bought_at, created_at")
      .eq("list_type", "comida")
      .order("is_bought", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("meal_plans")
      .select("meal_date, description, meal_types(name)")
      .gte("meal_date", weekStart)
      .lte("meal_date", weekEnd),
    supabase
      .from("budget_weeks")
      .select("budget_amount")
      .eq("week_start", weekStart)
      .eq("budget_type", "comida")
      .maybeSingle(),
    supabase
      .from("recipes")
      .select("title, calories_per_serving")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (expensesRes.error) throw new Error(expensesRes.error.message);
  if (shoppingRes.error) throw new Error(shoppingRes.error.message);
  if (mealsRes.error) throw new Error(mealsRes.error.message);

  const expenses = expensesRes.data || [];
  const expenseIds = expenses.map((expense: any) => expense.id);
  const itemsRes = expenseIds.length > 0
    ? await supabase
        .from("expense_items")
        .select("expense_id, name, quantity, unit_price")
        .in("expense_id", expenseIds)
    : { data: [], error: null };

  if (itemsRes.error) throw new Error(itemsRes.error.message);

  const expenseById = new Map(expenses.map((expense: any) => [expense.id, expense]));
  const grouped = new Map<string, MealSuggestionContext["available_items"][number]>();
  const excluded = new Set<string>();

  for (const item of itemsRes.data || []) {
    const name = displayFoodName(item.name || "");
    if (!name) continue;
    if (!isLikelyFoodProduct(name)) {
      excluded.add(name);
      continue;
    }

    const normalized = normalizeFoodName(name);
    if (!normalized) continue;

    const expense: any = expenseById.get(item.expense_id);
    const quantity = Number(item.quantity) || 1;
    const spent = quantity * (Number(item.unit_price) || 0);
    const existing = grouped.get(normalized);

    if (existing) {
      existing.bought_count += 1;
      existing.quantity_total += quantity;
      existing.estimated_spent += spent;
      if (expense?.expense_date && expense.expense_date > existing.latest_date) {
        existing.latest_date = expense.expense_date;
        existing.name = name;
      }
    } else {
      grouped.set(normalized, {
        name,
        normalized_name: normalized,
        bought_count: 1,
        quantity_total: quantity,
        latest_date: expense?.expense_date || options.mealDate,
        estimated_spent: spent,
      });
    }
  }

  const availableItems = [...grouped.values()]
    .sort((a, b) => b.latest_date.localeCompare(a.latest_date) || b.bought_count - a.bought_count)
    .slice(0, 35);

  const pendingShoppingItems = (shoppingRes.data || [])
    .filter((item: any) => !item.is_bought && isLikelyFoodProduct(item.name || ""))
    .slice(0, 30)
    .map((item: any) => ({
      name: displayFoodName(item.name),
      quantity: Number(item.quantity) || 1,
    }));

  const plannedMeals = (mealsRes.data || []).map((meal: any) => ({
    date: meal.meal_date,
    meal_type: meal.meal_types?.name || "",
    description: meal.description,
  }));

  const budgetAmount = Number(budgetRes.data?.budget_amount) || 0;
  const spentSoFar = expenses
    .filter((expense: any) => expense.expense_date >= weekStart && expense.expense_date <= weekEnd)
    .reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);

  return {
    meal: {
      date: options.mealDate,
      type_id: options.mealTypeId,
      type_name: mealType.name,
      people: options.people,
    },
    preferences: options.preferences,
    available_items: availableItems,
    pending_shopping_items: pendingShoppingItems,
    planned_meals_this_week: plannedMeals,
    recent_recipes: (recipesRes.data || []).map((recipe: any) => ({
      title: recipe.title,
      calories_per_serving: recipe.calories_per_serving === null ? null : Number(recipe.calories_per_serving),
    })),
    budget: {
      week_start: weekStart,
      budget_amount: budgetAmount,
      spent_so_far: spentSoFar,
      remaining: budgetAmount - spentSoFar,
    },
    excluded_likely_non_food: [...excluded].slice(0, 20),
  };
}

async function fetchMealType(supabase: SupabaseLike, mealTypeId: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("meal_types")
    .select("id, name")
    .eq("id", mealTypeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id || !data?.name) throw new Error("Tipo de comida no encontrado");
  return data;
}