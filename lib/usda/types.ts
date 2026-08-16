/**
 * Minimal typings for the subset of the USDA FoodData Central API we consume.
 * https://fdc.nal.usda.gov/api-guide.html
 */

export interface UsdaNutrient {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
  /** Present on the food detail endpoint instead of the flat shape above. */
  nutrient?: {
    id?: number;
    number?: string;
    name?: string;
    unitName?: string;
  };
  amount?: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
}

export interface UsdaSearchResponse {
  totalHits?: number;
  currentPage?: number;
  foods?: UsdaFood[];
}

/**
 * USDA nutrient numbers. These are stable identifiers; nutrient *names* vary
 * between data types, so always match on the number.
 */
export const NUTRIENT_NUMBERS = {
  /** Energy, kcal. */
  energy: '208',
  /** Energy (Atwater general factors), kcal — used by some Foundation foods. */
  energyAtwaterGeneral: '957',
  /** Energy (Atwater specific factors), kcal. */
  energyAtwaterSpecific: '958',
  protein: '203',
  fat: '204',
  carbs: '205',
} as const;

/** Data types in preference order — curated data first, branded last. */
export const PREFERRED_DATA_TYPES = [
  'Foundation',
  'SR Legacy',
  'Survey (FNDDS)',
  'Branded',
] as const;
