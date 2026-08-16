import { describe, expect, it } from 'vitest';
import { calculateBMR } from '@/lib/calculations/bmr';
import {
  ACTIVITY_MULTIPLIERS,
  calculateCalorieTarget,
  calculateTDEE,
  GOAL_ADJUSTMENTS,
} from '@/lib/calculations/tdee';
import {
  calculateMacros,
  caloriesFromMacros,
  KCAL_PER_GRAM,
  PROTEIN_G_PER_KG,
} from '@/lib/calculations/macros';
import { calculateTargets } from '@/lib/calculations/targets';

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('matches the published formula for men', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(
      calculateBMR({ weightKg: 80, heightCm: 180, age: 30, gender: 'male' }),
    ).toBe(1780);
  });

  it('matches the published formula for women', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25 -> 1370
    expect(
      calculateBMR({ weightKg: 65, heightCm: 165, age: 30, gender: 'female' }),
    ).toBe(1370);
  });

  it('places "other" between the male and female constants', () => {
    const shared = { weightKg: 70, heightCm: 170, age: 30 } as const;
    const male = calculateBMR({ ...shared, gender: 'male' });
    const female = calculateBMR({ ...shared, gender: 'female' });
    const other = calculateBMR({ ...shared, gender: 'other' });

    expect(other).toBeGreaterThan(female);
    expect(other).toBeLessThan(male);
  });

  it('never returns a negative value for extreme inputs', () => {
    expect(
      calculateBMR({ weightKg: 25, heightCm: 80, age: 120, gender: 'female' }),
    ).toBeGreaterThanOrEqual(0);
  });

  it('increases with weight and decreases with age', () => {
    const base = { heightCm: 175, age: 30, gender: 'male' } as const;
    expect(calculateBMR({ ...base, weightKg: 90 })).toBeGreaterThan(
      calculateBMR({ ...base, weightKg: 70 }),
    );
    expect(
      calculateBMR({ weightKg: 70, heightCm: 175, age: 50, gender: 'male' }),
    ).toBeLessThan(calculateBMR({ weightKg: 70, heightCm: 175, age: 30, gender: 'male' }));
  });
});

describe('calculateTDEE', () => {
  it('applies the activity multiplier', () => {
    expect(calculateTDEE(1800, 'sedentary')).toBe(Math.round(1800 * 1.2));
    expect(calculateTDEE(1800, 'very_active')).toBe(Math.round(1800 * 1.725));
  });

  it('is monotonic across activity levels', () => {
    const levels = [
      'sedentary',
      'lightly_active',
      'moderately_active',
      'very_active',
    ] as const;

    const values = levels.map((level) => calculateTDEE(1700, level));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('exposes multipliers within the accepted physiological range', () => {
    for (const multiplier of Object.values(ACTIVITY_MULTIPLIERS)) {
      expect(multiplier).toBeGreaterThanOrEqual(1.2);
      expect(multiplier).toBeLessThanOrEqual(1.9);
    }
  });
});

describe('calculateCalorieTarget', () => {
  it('subtracts a deficit when losing weight', () => {
    expect(calculateCalorieTarget(2400, 'lose_weight', 'male')).toBe(
      2400 + GOAL_ADJUSTMENTS.lose_weight,
    );
  });

  it('leaves TDEE untouched when maintaining', () => {
    expect(calculateCalorieTarget(2400, 'maintain_weight', 'female')).toBe(2400);
  });

  it('adds a surplus when gaining weight', () => {
    expect(calculateCalorieTarget(2400, 'gain_weight', 'male')).toBeGreaterThan(2400);
  });

  it('applies the safety floor rather than an unsafe deficit', () => {
    // TDEE 1500 - 500 = 1000, which is below the 1200 floor for women.
    expect(calculateCalorieTarget(1500, 'lose_weight', 'female')).toBe(1200);
    // Men have a higher floor.
    expect(calculateCalorieTarget(1800, 'lose_weight', 'male')).toBe(1500);
  });

  it('never lets the floor push a small person into a surplus', () => {
    // A TDEE below the floor must not produce a target above TDEE.
    const target = calculateCalorieTarget(1100, 'lose_weight', 'female');
    expect(target).toBeLessThanOrEqual(1100);
  });
});

describe('calculateMacros', () => {
  it('sets protein from bodyweight', () => {
    const macros = calculateMacros({
      calorieTarget: 2200,
      weightKg: 70,
      goal: 'maintain_weight',
    });
    expect(macros.protein_g).toBe(
      Math.round(PROTEIN_G_PER_KG.maintain_weight * 70),
    );
  });

  it('reconciles macros back to the calorie target', () => {
    const target = 2000;
    const macros = calculateMacros({
      calorieTarget: target,
      weightKg: 68,
      goal: 'lose_weight',
    });

    // Rounding to whole grams costs a few calories; anything under 10 is fine.
    expect(Math.abs(caloriesFromMacros(macros) - target)).toBeLessThan(10);
  });

  it('never produces negative carbs, even for a heavy user on a deep deficit', () => {
    const macros = calculateMacros({
      calorieTarget: 1200,
      weightKg: 150,
      goal: 'lose_weight',
    });

    expect(macros.carbs_g).toBeGreaterThanOrEqual(0);
    expect(macros.protein_g).toBeGreaterThan(0);
    expect(macros.fat_g).toBeGreaterThan(0);
  });

  it('keeps fat at or above the 0.5 g/kg floor in normal conditions', () => {
    const weightKg = 60;
    const macros = calculateMacros({
      calorieTarget: 2000,
      weightKg,
      goal: 'maintain_weight',
    });
    expect(macros.fat_g).toBeGreaterThanOrEqual(Math.round(0.5 * weightKg) - 1);
  });

  it('uses Atwater energy factors', () => {
    expect(KCAL_PER_GRAM.protein).toBe(4);
    expect(KCAL_PER_GRAM.carbs).toBe(4);
    expect(KCAL_PER_GRAM.fat).toBe(9);
  });
});

describe('calculateTargets', () => {
  const profile = {
    age: 30,
    gender: 'male',
    height_cm: 178,
    weight_kg: 82,
    activity_level: 'moderately_active',
    goal: 'lose_weight',
  } as const;

  it('chains BMR -> TDEE -> calories -> macros consistently', () => {
    const targets = calculateTargets(profile);

    const bmr = calculateBMR({
      weightKg: profile.weight_kg,
      heightCm: profile.height_cm,
      age: profile.age,
      gender: profile.gender,
    });

    expect(targets.bmr).toBe(bmr);
    expect(targets.tdee).toBe(calculateTDEE(bmr, profile.activity_level));
    expect(targets.calories).toBeLessThan(targets.tdee);
    expect(targets.tdee).toBeGreaterThan(targets.bmr);
  });

  it('produces plausible values for a typical adult', () => {
    const targets = calculateTargets(profile);

    expect(targets.calories).toBeGreaterThan(1200);
    expect(targets.calories).toBeLessThan(4000);
    expect(targets.protein_g).toBeGreaterThan(50);
    expect(targets.fat_g).toBeGreaterThan(20);
  });

  it('is deterministic', () => {
    expect(calculateTargets(profile)).toEqual(calculateTargets(profile));
  });
});
