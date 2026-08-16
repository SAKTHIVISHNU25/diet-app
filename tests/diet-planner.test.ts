import { describe, expect, it } from 'vitest';
import { generateTemplatePlan, getMealSplit } from '@/lib/diet/template-planner';
import { filterFoods, PLANNER_FOODS } from '@/lib/diet/food-database';
import { getDietPlanProvider, TemplateDietPlanProvider } from '@/lib/diet/provider';
import { calculateTargets } from '@/lib/calculations/targets';
import type { PlannerProfileInput } from '@/lib/diet/types';

const TARGETS = calculateTargets({
  age: 30,
  gender: 'male',
  height_cm: 178,
  weight_kg: 78,
  activity_level: 'moderately_active',
  goal: 'maintain_weight',
});

const PROFILE: PlannerProfileInput = {
  dietary_preference: 'non_vegetarian',
  allergies: [],
  food_preferences: [],
  meals_per_day: 4,
  goal: 'maintain_weight',
};

describe('meal splits', () => {
  it('provides a split for every supported meal count', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const split = getMealSplit(count);
      expect(split).toHaveLength(count);
    }
  });

  it('splits sum to the whole day', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const total = getMealSplit(count).reduce((sum, slot) => sum + slot.share, 0);
      expect(total).toBeCloseTo(1, 2);
    }
  });

  it('falls back to the 4-meal split for an unsupported count', () => {
    expect(getMealSplit(99)).toEqual(getMealSplit(4));
  });
});

describe('filterFoods', () => {
  it('excludes meat for vegetarians', () => {
    const foods = filterFoods('vegetarian', [], []);
    expect(foods.some((food) => food.id === 'chicken-breast')).toBe(false);
    expect(foods.some((food) => food.id === 'paneer')).toBe(true);
  });

  it('excludes dairy and eggs for vegans', () => {
    const foods = filterFoods('vegan', [], []);
    expect(foods.some((food) => food.id === 'paneer')).toBe(false);
    expect(foods.some((food) => food.id === 'eggs')).toBe(false);
    expect(foods.some((food) => food.id === 'tofu')).toBe(true);
  });

  it('allows eggs but not meat for eggetarians', () => {
    const foods = filterFoods('eggetarian', [], []);
    expect(foods.some((food) => food.id === 'eggs')).toBe(true);
    expect(foods.some((food) => food.id === 'fish-curry')).toBe(false);
  });

  it('removes allergens, matching in both directions', () => {
    expect(
      filterFoods('non_vegetarian', ['peanut'], []).some(
        (food) => food.id === 'peanuts',
      ),
    ).toBe(false);

    // "nuts" (user) must match the "tree nuts" allergen on almonds.
    expect(
      filterFoods('non_vegetarian', ['nuts'], []).some((food) => food.id === 'almonds'),
    ).toBe(false);
  });

  it('is case and whitespace insensitive for allergies', () => {
    expect(
      filterFoods('non_vegetarian', ['  DAIRY '], []).some(
        (food) => food.id === 'paneer',
      ),
    ).toBe(false);
  });

  it('removes disliked foods by name', () => {
    expect(
      filterFoods('non_vegetarian', [], ['tofu']).some((food) => food.id === 'tofu'),
    ).toBe(false);
  });

  it('leaves the source database untouched', () => {
    const before = PLANNER_FOODS.length;
    filterFoods('vegan', ['nuts', 'soy'], ['rice']);
    expect(PLANNER_FOODS.length).toBe(before);
  });
});

describe('generateTemplatePlan', () => {
  it('builds 7 days at the configured meal count', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 1 });

    expect(plan.meals).toHaveLength(7 * PROFILE.meals_per_day);
    expect(new Set(plan.meals.map((meal) => meal.day_index)).size).toBe(7);
    expect(plan.generator).toBe('template');
  });

  it('is deterministic for the same seed', () => {
    const a = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 7 });
    const b = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 7 });
    expect(a).toEqual(b);
  });

  it('produces a different plan for a different seed', () => {
    const a = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 1 });
    const b = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 500 });
    expect(a.meals.map((m) => m.name).join()).not.toBe(
      b.meals.map((m) => m.name).join(),
    );
  });

  it('carries the user targets through to the plan', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 3 });
    expect(plan.calorieTarget).toBe(TARGETS.calories);
    expect(plan.proteinTargetG).toBe(TARGETS.protein_g);
  });

  it('lands each day within a realistic range of the calorie target', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 11 });

    for (let day = 0; day < 7; day += 1) {
      const total = plan.meals
        .filter((meal) => meal.day_index === day)
        .reduce((sum, meal) => sum + meal.calories, 0);

      // Portions are clamped to sensible bounds, so exact target-matching is
      // not a goal; being in the right neighbourhood is.
      expect(total).toBeGreaterThan(TARGETS.calories * 0.6);
      expect(total).toBeLessThan(TARGETS.calories * 1.4);
    }
  });

  it('never suggests an absurd portion', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 21 });

    for (const meal of plan.meals) {
      for (const food of meal.foods) {
        expect(food.grams).toBeGreaterThan(0);
        expect(food.grams).toBeLessThanOrEqual(500);
      }
    }
  });

  it('keeps each meal total equal to the sum of its foods', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 5 });

    for (const meal of plan.meals) {
      const summed = meal.foods.reduce((sum, food) => sum + food.calories, 0);
      expect(Math.abs(meal.calories - summed)).toBeLessThanOrEqual(1);
    }
  });

  it('respects allergies across every meal of the week', () => {
    const plan = generateTemplatePlan({
      profile: { ...PROFILE, allergies: ['dairy', 'nuts'] },
      targets: TARGETS,
      seed: 9,
    });

    const names = plan.meals.flatMap((meal) =>
      meal.foods.map((food) => food.name.toLowerCase()),
    );

    expect(names.some((name) => name.includes('paneer'))).toBe(false);
    expect(names.some((name) => name.includes('almond'))).toBe(false);
    expect(names.some((name) => name.includes('curd'))).toBe(false);
  });

  it('respects a vegan preference across every meal', () => {
    const plan = generateTemplatePlan({
      profile: { ...PROFILE, dietary_preference: 'vegan' },
      targets: TARGETS,
      seed: 4,
    });

    const names = plan.meals.flatMap((meal) =>
      meal.foods.map((food) => food.name.toLowerCase()),
    );

    for (const banned of ['chicken', 'fish', 'egg', 'paneer', 'curd', 'ghee']) {
      expect(names.some((name) => name.includes(banned))).toBe(false);
    }
  });

  it('works for every meals-per-day setting', () => {
    for (const mealsPerDay of [2, 3, 4, 5, 6]) {
      const plan = generateTemplatePlan({
        profile: { ...PROFILE, meals_per_day: mealsPerDay },
        targets: TARGETS,
        seed: 2,
      });
      expect(plan.meals).toHaveLength(7 * mealsPerDay);
    }
  });

  it('gives every meal a name and at least one food', () => {
    const plan = generateTemplatePlan({ profile: PROFILE, targets: TARGETS, seed: 6 });

    for (const meal of plan.meals) {
      expect(meal.name.trim().length).toBeGreaterThan(0);
      expect(meal.foods.length).toBeGreaterThan(0);
    }
  });
});

describe('diet plan provider', () => {
  it('defaults to the template planner with no configuration', () => {
    delete process.env.DIET_PLAN_PROVIDER;
    expect(getDietPlanProvider()).toBeInstanceOf(TemplateDietPlanProvider);
  });

  it('falls back to the template planner for an unknown provider', () => {
    process.env.DIET_PLAN_PROVIDER = 'some-paid-ai';
    expect(getDietPlanProvider()).toBeInstanceOf(TemplateDietPlanProvider);
    delete process.env.DIET_PLAN_PROVIDER;
  });

  it('generates a plan through the provider interface', async () => {
    const plan = await new TemplateDietPlanProvider().generatePlan({
      profile: PROFILE,
      targets: TARGETS,
      seed: 1,
    });
    expect(plan.meals.length).toBeGreaterThan(0);
  });
});
