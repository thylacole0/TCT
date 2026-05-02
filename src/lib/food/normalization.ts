const NON_FOOD_TERMS = [
  "aseo",
  "bolsa basura",
  "bolsas basura",
  "cloro",
  "confort",
  "desinfectante",
  "detergente",
  "escoba",
  "esponja",
  "lavaloza",
  "lavalozas",
  "limpiador",
  "papel higienico",
  "servilleta",
  "suavizante",
  "virutilla",
];

const NOISE_TERMS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "un",
  "una",
  "pack",
  "kg",
  "gr",
  "g",
  "lt",
  "l",
  "unidad",
  "unidades",
]);

export function normalizeFoodName(value: string): string {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !NOISE_TERMS.has(part) && !/^\d+$/.test(part))
    .join(" ")
    .trim();
}

export function isLikelyFoodProduct(value: string): boolean {
  const normalized = normalizeFoodName(value);
  if (!normalized) return false;
  return !NON_FOOD_TERMS.some((term) => normalized.includes(term));
}

export function displayFoodName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}