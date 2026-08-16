import { describe, expect, it } from 'vitest';
import {
  cleanDescription,
  hasUsableNutrition,
  normalizeUsdaFood,
} from '@/lib/usda/nutrition';
import { rankResults } from '@/lib/usda/search';
import type { UsdaFood } from '@/lib/usda/types';
import { humanizeFoodLabel, normalizeFoodQuery, seededRandom } from '@/lib/utils';
import {
  suggestPortion,
  clampPortion,
  plausibleRange,
  DEFAULT_PORTION_GRAMS,
} from '@/lib/vision/portions';

describe('normalizeUsdaFood', () => {
  it('reads the flat search-result nutrient shape', () => {
    const food: UsdaFood = {
      fdcId: 171077,
      description: 'CHICKEN, BROILERS OR FRYERS, BREAST, MEAT ONLY, RAW',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientNumber: '208', unitName: 'KCAL', value: 165 },
        { nutrientNumber: '203', unitName: 'G', value: 31 },
        { nutrientNumber: '205', unitName: 'G', value: 0 },
        { nutrientNumber: '204', unitName: 'G', value: 3.6 },
      ],
    };

    const item = normalizeUsdaFood(food);
    expect(item.caloriesPer100g).toBe(165);
    expect(item.proteinPer100g).toBe(31);
    expect(item.fatPer100g).toBe(3.6);
    expect(item.fdcId).toBe('171077');
    expect(item.source).toBe('usda');
  });

  it('reads the nested food-detail nutrient shape', () => {
    const food: UsdaFood = {
      fdcId: 1,
      description: 'Test food',
      foodNutrients: [
        { nutrient: { number: '208', unitName: 'kcal' }, amount: 120 },
        { nutrient: { number: '203', unitName: 'g' }, amount: 8 },
      ],
    };

    const item = normalizeUsdaFood(food);
    expect(item.caloriesPer100g).toBe(120);
    expect(item.proteinPer100g).toBe(8);
  });

  it('handles zero-padded nutrient numbers', () => {
    const item = normalizeUsdaFood({
      fdcId: 2,
      description: 'Padded',
      foodNutrients: [{ nutrientNumber: '0208', unitName: 'KCAL', value: 99 }],
    });
    expect(item.caloriesPer100g).toBe(99);
  });

  it('falls back to the Atwater energy nutrients', () => {
    const item = normalizeUsdaFood({
      fdcId: 3,
      description: 'Atwater only',
      foodNutrients: [{ nutrientNumber: '957', unitName: 'kcal', value: 210 }],
    });
    expect(item.caloriesPer100g).toBe(210);
  });

  it('converts kJ to kcal when no kcal value is present', () => {
    const item = normalizeUsdaFood({
      fdcId: 4,
      description: 'Kilojoules',
      foodNutrients: [{ nutrientNumber: '208', unitName: 'kJ', value: 418.4 }],
    });
    expect(item.caloriesPer100g).toBeCloseTo(100, 1);
  });

  it('defaults missing nutrients to zero rather than undefined', () => {
    const item = normalizeUsdaFood({ fdcId: 5, description: 'Empty' });
    expect(item.caloriesPer100g).toBe(0);
    expect(item.proteinPer100g).toBe(0);
    expect(item.carbsPer100g).toBe(0);
    expect(item.fatPer100g).toBe(0);
  });

  it('only reports a serving size when USDA gives it in grams', () => {
    expect(
      normalizeUsdaFood({
        fdcId: 6,
        description: 'Cup food',
        servingSize: 1,
        servingSizeUnit: 'cup',
      }).servingSizeGrams,
    ).toBeUndefined();

    expect(
      normalizeUsdaFood({
        fdcId: 7,
        description: 'Gram food',
        servingSize: 30,
        servingSizeUnit: 'g',
      }).servingSizeGrams,
    ).toBe(30);
  });
});

describe('cleanDescription', () => {
  it('title-cases shouty USDA descriptions', () => {
    expect(cleanDescription('CHICKEN, BREAST, RAW')).toBe('Chicken, Breast, Raw');
  });

  it('keeps minor words lowercase inside the phrase', () => {
    expect(cleanDescription('BEANS AND RICE')).toBe('Beans and Rice');
  });

  it('leaves already mixed-case text alone', () => {
    expect(cleanDescription('Greek Yogurt, plain')).toBe('Greek Yogurt, plain');
  });

  it('collapses runs of whitespace', () => {
    expect(cleanDescription('Rice,    white')).toBe('Rice, white');
  });
});

describe('hasUsableNutrition', () => {
  const base = {
    name: 'x',
    source: 'usda' as const,
    caloriesPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
  };

  it('rejects an all-zero food', () => {
    expect(hasUsableNutrition(base)).toBe(false);
  });

  it('accepts a food with any non-zero macro', () => {
    expect(hasUsableNutrition({ ...base, proteinPer100g: 5 })).toBe(true);
  });
});

describe('rankResults', () => {
  const foods: UsdaFood[] = [
    { fdcId: 1, description: 'BRANDED CHICKEN NUGGET DINNER KIT', dataType: 'Branded' },
    { fdcId: 2, description: 'Chicken, breast', dataType: 'Foundation' },
    { fdcId: 3, description: 'Chicken breast, oven roasted, deli sliced', dataType: 'SR Legacy' },
  ];

  it('prefers curated data types over branded products', () => {
    const [first] = rankResults(foods, 'chicken breast');
    expect(first?.dataType).toBe('Foundation');
  });

  it('puts branded entries last', () => {
    const ranked = rankResults(foods, 'chicken breast');
    expect(ranked[ranked.length - 1]?.dataType).toBe('Branded');
  });

  it('does not mutate the input array', () => {
    const original = [...foods];
    rankResults(foods, 'chicken');
    expect(foods).toEqual(original);
  });
});

describe('text normalization helpers', () => {
  it('turns model labels into readable names', () => {
    expect(humanizeFoodLabel('chicken_curry')).toBe('Chicken Curry');
    expect(humanizeFoodLabel('baby_back_ribs')).toBe('Baby Back Ribs');
    expect(humanizeFoodLabel('BEEF-CARPACCIO')).toBe('Beef Carpaccio');
  });

  it('builds a stable cache key', () => {
    expect(normalizeFoodQuery('  Chicken  Breast! ')).toBe('chicken breast');
    expect(normalizeFoodQuery('Yogurt (Greek), plain')).toBe('yogurt greek plain');
  });

  it('produces the same key regardless of punctuation or case', () => {
    expect(normalizeFoodQuery('Cafe Latte')).toBe(normalizeFoodQuery('cafe, LATTE!'));
  });
});

describe('suggestPortion', () => {
  it('matches category rules', () => {
    expect(suggestPortion('pizza').grams).toBe(125);
    expect(suggestPortion('miso_soup').grams).toBe(350);
    expect(suggestPortion('caesar_salad').grams).toBe(150);
  });

  it('handles spaces as well as underscores', () => {
    expect(suggestPortion('ice cream').grams).toBe(suggestPortion('ice_cream').grams);
  });

  it('falls back to a default for unknown foods', () => {
    expect(suggestPortion('zzzz_unknown_food').grams).toBe(DEFAULT_PORTION_GRAMS);
  });

  it('always returns a positive portion with a label', () => {
    const result = suggestPortion('');
    expect(result.grams).toBeGreaterThan(0);
    expect(result.label).toBeTruthy();
  });

  it('sizes South Indian items per piece, not per plate', () => {
    expect(suggestPortion('plain dosa').grams).toBe(90);
    expect(suggestPortion('idli').grams).toBe(45);
  });
});

describe('clampPortion', () => {
  it('bounds an overestimated single serving', () => {
    // The reported case: a plain dosa read as 350 g, which is ~3 dosas'
    // worth of every macro.
    const result = clampPortion('dosa', 350);
    expect(result.grams).toBe(160);
    expect(result.clamped).toBe(true);
    expect(result.originalGrams).toBe(350);
  });

  it('scales the bound by the number of pieces', () => {
    // Three dosas really can weigh 300 g, so that must pass through.
    expect(clampPortion('dosa', 300, 3)).toEqual({ grams: 300, clamped: false });
  });

  it('leaves a plausible estimate untouched', () => {
    expect(clampPortion('chicken breast', 170)).toEqual({ grams: 170, clamped: false });
    expect(clampPortion('miso soup', 350)).toEqual({ grams: 350, clamped: false });
  });

  it('raises an implausibly small estimate to the floor', () => {
    const result = clampPortion('biryani', 10);
    expect(result.grams).toBe(100);
    expect(result.clamped).toBe(true);
  });

  it('falls back to the category default when the model gave no weight', () => {
    expect(clampPortion('dosa', 0).grams).toBe(90);
    expect(clampPortion('dosa', Number.NaN, 2).grams).toBe(180);
  });

  it('bounds unknown foods to a wide but finite range', () => {
    expect(clampPortion('zzzz_unknown_food', 4000).grams).toBe(600);
  });

  it('treats a zero or negative quantity as one piece', () => {
    expect(plausibleRange('dosa', 0)).toEqual(plausibleRange('dosa', 1));
  });
});

describe('seededRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different sequences for different seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('stays within [0, 1)', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not get stuck at zero for a zero seed', () => {
    const random = seededRandom(0);
    expect(random()).toBeGreaterThan(0);
  });
});
