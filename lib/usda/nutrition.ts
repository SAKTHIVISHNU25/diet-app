import type { FoodItem } from '@/types/food';
import { NUTRIENT_NUMBERS, type UsdaFood, type UsdaNutrient } from './types';

/**
 * USDA returns nutrients in two shapes depending on the endpoint:
 *   search  -> { nutrientNumber, value }
 *   detail  -> { nutrient: { number }, amount }
 * This reads both.
 */
function readNutrient(nutrient: UsdaNutrient): {
  number: string | undefined;
  value: number | undefined;
  unit: string | undefined;
} {
  return {
    number: nutrient.nutrientNumber ?? nutrient.nutrient?.number,
    value: nutrient.value ?? nutrient.amount,
    unit: (nutrient.unitName ?? nutrient.nutrient?.unitName)?.toLowerCase(),
  };
}

function findNutrientValue(
  nutrients: UsdaNutrient[],
  ...numbers: string[]
): number | undefined {
  for (const wanted of numbers) {
    for (const nutrient of nutrients) {
      const { number, value } = readNutrient(nutrient);
      // Nutrient numbers are sometimes zero-padded ("208" vs "0208").
      if (number && value != null && stripLeadingZeros(number) === wanted) {
        return value;
      }
    }
  }
  return undefined;
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+(?=\d)/, '');
}

/**
 * Energy in kcal.
 *
 * Some foods report energy only in kJ, and some Foundation foods carry the
 * Atwater variants instead of nutrient 208. We try kcal first, then the Atwater
 * numbers, then convert from kJ (1 kcal = 4.184 kJ).
 */
function readCalories(nutrients: UsdaNutrient[]): number {
  const kcalEntry = nutrients.find((n) => {
    const { number, unit } = readNutrient(n);
    return number && stripLeadingZeros(number) === NUTRIENT_NUMBERS.energy && unit === 'kcal';
  });

  if (kcalEntry) {
    const { value } = readNutrient(kcalEntry);
    if (value != null) return value;
  }

  const atwater = findNutrientValue(
    nutrients,
    NUTRIENT_NUMBERS.energyAtwaterSpecific,
    NUTRIENT_NUMBERS.energyAtwaterGeneral,
  );
  if (atwater != null) return atwater;

  const anyEnergy = nutrients.find((n) => {
    const { number } = readNutrient(n);
    return number && stripLeadingZeros(number) === NUTRIENT_NUMBERS.energy;
  });

  if (anyEnergy) {
    const { value, unit } = readNutrient(anyEnergy);
    if (value != null) return unit === 'kj' ? value / 4.184 : value;
  }

  return 0;
}

/**
 * Normalize a USDA food into the app's internal per-100 g shape.
 *
 * USDA `foodNutrients` values are per 100 g for every data type we request
 * (including Branded — its per-serving values live in `labelNutrients`, which
 * we do not use), so no unit conversion is needed here.
 */
export function normalizeUsdaFood(food: UsdaFood): FoodItem {
  const nutrients = food.foodNutrients ?? [];

  return {
    fdcId: String(food.fdcId),
    name: cleanDescription(food.description),
    brand: food.brandName ?? food.brandOwner ?? undefined,
    source: 'usda',
    caloriesPer100g: round2(readCalories(nutrients)),
    proteinPer100g: round2(findNutrientValue(nutrients, NUTRIENT_NUMBERS.protein) ?? 0),
    carbsPer100g: round2(findNutrientValue(nutrients, NUTRIENT_NUMBERS.carbs) ?? 0),
    fatPer100g: round2(findNutrientValue(nutrients, NUTRIENT_NUMBERS.fat) ?? 0),
    servingSizeGrams:
      food.servingSizeUnit?.toLowerCase() === 'g' && food.servingSize
        ? food.servingSize
        : undefined,
    servingSizeLabel: food.householdServingFullText ?? undefined,
  };
}

/**
 * USDA descriptions are upper-case and comma-inverted
 * ("CHICKEN, BROILERS OR FRYERS, BREAST, MEAT ONLY, RAW").
 * Convert to something readable without losing the qualifiers.
 */
export function cleanDescription(description: string): string {
  const trimmed = description.trim();
  const isShouty = trimmed === trimmed.toUpperCase();
  const base = isShouty ? toTitleCase(trimmed) : trimmed;
  return base.replace(/\s+/g, ' ');
}

function toTitleCase(value: string): string {
  const minorWords = new Set(['and', 'or', 'with', 'in', 'of', 'the', 'a', 'on']);
  return value
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index > 0 && minorWords.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** A food with no energy value is unusable for tracking; filter these out. */
export function hasUsableNutrition(item: FoodItem): boolean {
  return (
    item.caloriesPer100g > 0 ||
    item.proteinPer100g > 0 ||
    item.carbsPer100g > 0 ||
    item.fatPer100g > 0
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
