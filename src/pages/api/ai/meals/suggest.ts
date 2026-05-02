import type { APIRoute } from "astro";
import { createAuthClient } from "../../../../lib/supabase";
import { DEFAULT_GEMINI_MODEL, generateGeminiJson } from "../../../../lib/ai/gemini";
import { checkAiRateLimit } from "../../../../lib/ai/rateLimit";
import { MEAL_SUGGESTION_SYSTEM_PROMPT, buildMealSuggestionPrompt } from "../../../../lib/ai/prompts";
import { mealSuggestionResponseSchema, parseMealSuggestionResponse } from "../../../../lib/ai/schemas";
import { buildMealSuggestionContext, type MealSuggestionPreferences } from "../../../../lib/food/context";
import { todayChile } from "../../../../lib/dates";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "GEMINI_API_KEY no está configurada" }, 503);
  }

  const rateLimit = checkAiRateLimit(user.id);
  if (!rateLimit.allowed) {
    return json(
      { error: `Demasiadas solicitudes de IA. Intenta nuevamente en ${rateLimit.retryAfterSeconds} segundos.` },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const mealDate = typeof body.meal_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.meal_date)
      ? body.meal_date
      : todayChile();
    const mealTypeId = typeof body.meal_type_id === "string" ? body.meal_type_id : "";
    const people = clampInteger(body.people, 1, 8, 2);

    if (!mealTypeId) {
      return json({ error: "meal_type_id required" }, 400);
    }

    const preferences: MealSuggestionPreferences = {
      healthy: body.preferences?.healthy !== false,
      max_calories_per_serving: nullableNumber(body.preferences?.max_calories_per_serving),
      avoid: stringArray(body.preferences?.avoid).slice(0, 12),
      prefer: stringArray(body.preferences?.prefer).slice(0, 12),
    };

    const context = await buildMealSuggestionContext(supabase, {
      mealDate,
      mealTypeId,
      people,
      preferences,
    });

    const model = import.meta.env.AI_MODEL || DEFAULT_GEMINI_MODEL;
    const prompt = buildMealSuggestionPrompt(context);
    const parsed = await generateParsedSuggestions({ apiKey, model, prompt });
    const { data: generation, error: generationError } = await supabase
      .from("ai_generations")
      .insert({
        type: "meal_suggestion",
        provider: "gemini",
        model,
        input_json: { request: { meal_date: mealDate, meal_type_id: mealTypeId, people, preferences }, context },
        output_json: parsed,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (generationError || !generation?.id) {
      throw new Error(generationError?.message || "No se pudo registrar auditoria IA");
    }

    return json({
      ...parsed,
      ai_generation_id: generation.id,
      context_summary: {
        available_items: context.available_items.length,
        pending_items: context.pending_shopping_items.length,
        excluded_likely_non_food: context.excluded_likely_non_food,
      },
    });
  } catch (error: any) {
    return json({ error: error.message || "No se pudieron generar sugerencias" }, 500);
  }
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function generateParsedSuggestions({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  try {
    const raw = await requestGeminiSuggestions(apiKey, model, prompt);
    return parseMealSuggestionResponse(raw);
  } catch (error: any) {
    if (!isRetryableAiFormatError(error)) throw error;

    const retryPrompt = `${prompt}\n\nCorreccion obligatoria: la respuesta anterior no fue JSON valido o no cumplio el schema. Devuelve solo JSON valido, sin markdown, sin texto extra, con macros por porcion en gramos.`;
    const retryRaw = await requestGeminiSuggestions(apiKey, model, retryPrompt);
    return parseMealSuggestionResponse(retryRaw);
  }
}

function requestGeminiSuggestions(apiKey: string, model: string, prompt: string) {
  return generateGeminiJson<unknown>({
    apiKey,
    model,
    systemInstruction: MEAL_SUGGESTION_SYSTEM_PROMPT,
    prompt,
    responseSchema: mealSuggestionResponseSchema,
    temperature: 0.25,
    maxOutputTokens: 4096,
  });
}

function isRetryableAiFormatError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /json|sugerencias|recetas|schema|unexpected/i.test(message);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function nullableNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}