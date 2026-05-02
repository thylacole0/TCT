import type { MealSuggestionContext } from "../food/context";

export const MEAL_SUGGESTION_SYSTEM_PROMPT = `Eres un experto en nutriologia aplicada a cocina familiar para TCT. Generas desayunos, almuerzos u onces sanas usando datos reales del hogar, con criterio nutricional practico y porciones realistas.

Reglas obligatorias:
- Responde solo JSON valido con el schema solicitado.
- Usa como base principal los productos disponibles entregados por TCT.
- No trates ingredientes faltantes como disponibles.
- Marca cada ingrediente como available, missing o suggested.
- Las estadisticas nutricionales son siempre por porcion: calories_per_serving en kcal/porcion; protein_g, carbs_g y fat_g en gramos por porcion.
- Estima macros de forma consistente: si incluyes proteina 12, significa 12 g de proteina por porcion.
- Usa porciones plausibles para adultos y ajusta cantidades a la cantidad de personas indicada.
- Si hay limite de kcal, no lo superes salvo que sea nutricionalmente imposible con los datos disponibles.
- Prioriza comidas sanas, simples, realistas y acordes al tipo de comida.
- Evita repetir comidas ya planificadas esta semana.
- Si faltan productos, proponlos como shopping_items.
- No incluyas productos no comestibles.
- Escribe health_note explicando brevemente por que la opcion es saludable y que macro destaca.
- No inventes precision clinica: son estimaciones nutricionales, no consejo medico.`;

export function buildMealSuggestionPrompt(context: MealSuggestionContext): string {
  return `Genera entre 2 y 4 opciones para ${context.meal.type_name}.

Contexto real de TCT:
${JSON.stringify(context, null, 2)}

Instrucciones de salida:
- Cada sugerencia debe tener title, meal_type, servings, calories_per_serving, protein_g, carbs_g, fat_g, health_note, ingredients, steps y shopping_items.
- servings debe coincidir con la cantidad de personas del contexto.
- calories_per_serving debe ser un numero entero de kcal por porcion.
- protein_g, carbs_g y fat_g deben ser gramos por porcion; usa null solo si realmente no puedes estimarlo.
- ingredients debe incluir todos los ingredientes importantes de la receta.
- La quantity de cada ingrediente debe representar la cantidad total para todas las porciones, no por porcion.
- shopping_items debe incluir solamente ingredientes missing necesarios para hacer la receta.
- Si una receta se puede hacer solo con available, shopping_items debe ser [].
- Evita titulos vagos; nombra proteina principal, carbohidrato o verdura clave cuando aplique.`;
}