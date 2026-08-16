import { describe, expect, it } from 'vitest';
import {
  calculateNutritionForGrams,
  percentOfTarget,
  rawPercent,
  remainingCalories,
  sumNutrition,
} from '@/lib/calculations/nutrition';
import type { NutritionPer100g } from '@/types/food';

const CHICKEN: NutritionPer100g = {
  caloriesPer100g: 165,
  proteinPer100g: 31,
  carbsPer100g: 0,
  fatPer100g: 3.6,
};

describe('calculateNutritionForGrams', () => {
  it('returns the source values unchanged at 100 g', () => {
    expect(calculateNutritionForGrams(CHICKEN, 100)).toEqual({
      calories: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
    });
  });

  it('doubles at 200 g', () => {
    expect(calculateNutritionForGrams(CHICKEN, 200)).toEqual({
      calories: 330,
      protein_g: 62,
      carbs_g: 0,
      fat_g: 7.2,
    });
  });

  it('halves at 50 g', () => {
    const result = calculateNutritionForGrams(CHICKEN, 50);
    expect(result.calories).toBe(83); // 82.5 rounds to 83
    expect(result.protein_g).toBe(15.5);
  });

  it('scales linearly for an arbitrary portion', () => {
    const result = calculateNutritionForGrams(CHICKEN, 175);
    expect(result.calories).toBe(Math.round(165 * 1.75));
    expect(result.protein_g).toBeCloseTo(54.3, 1);
  });

  it('returns zeroes for a zero portion', () => {
    expect(calculateNutritionForGrams(CHICKEN, 0)).toEqual({
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
  });

  it('treats a negative portion as zero rather than producing negative food', () => {
    const result = calculateNutritionForGrams(CHICKEN, -100);
    expect(result.calories).toBe(0);
    expect(result.protein_g).toBe(0);
  });

  it('rounds macros to one decimal place', () => {
    const result = calculateNutritionForGrams(CHICKEN, 33);
    expect(result.protein_g).toBe(10.2);
    expect(Number.isInteger(result.calories)).toBe(true);
  });
});

describe('sumNutrition', () => {
  it('returns zeroes for an empty log', () => {
    expect(sumNutrition([])).toEqual({
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
  });

  it('adds several entries', () => {
    const totals = sumNutrition([
      { calories: 300, protein_g: 20, carbs_g: 30, fat_g: 10 },
      { calories: 450, protein_g: 35, carbs_g: 40, fat_g: 15 },
    ]);

    expect(totals).toEqual({
      calories: 750,
      protein_g: 55,
      carbs_g: 70,
      fat_g: 25,
    });
  });

  it('coerces numeric strings, which a hand-edited database node can hold', () => {
    const totals = sumNutrition([
      // @ts-expect-error — deliberately exercising the string path
      { calories: '300', protein_g: '20.5', carbs_g: '30', fat_g: '10' },
    ]);

    expect(totals.calories).toBe(300);
    expect(totals.protein_g).toBe(20.5);
  });

  it('ignores unparseable values instead of producing NaN', () => {
    const totals = sumNutrition([
      // @ts-expect-error — deliberately exercising the bad-input path
      { calories: 'abc', protein_g: null, carbs_g: undefined, fat_g: 5 },
    ]);

    expect(Number.isNaN(totals.calories)).toBe(false);
    expect(totals.calories).toBe(0);
    expect(totals.fat_g).toBe(5);
  });
});

describe('remaining and percentages', () => {
  it('reports what is left against the target', () => {
    expect(remainingCalories(2000, 1500)).toBe(500);
  });

  it('goes negative when over target', () => {
    expect(remainingCalories(2000, 2300)).toBe(-300);
  });

  it('clamps the progress-bar percentage to 0-100', () => {
    expect(percentOfTarget(1000, 2000)).toBe(50);
    expect(percentOfTarget(3000, 2000)).toBe(100);
    expect(percentOfTarget(-50, 2000)).toBe(0);
  });

  it('reports the true percentage separately, uncapped', () => {
    expect(rawPercent(3000, 2000)).toBe(150);
  });

  it('does not divide by zero when no target is set', () => {
    expect(percentOfTarget(500, 0)).toBe(0);
    expect(rawPercent(500, 0)).toBe(0);
  });
});
