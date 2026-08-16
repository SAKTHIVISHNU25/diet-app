import { describe, expect, it } from 'vitest';
import {
  profileSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validations/profile';
import {
  foodLogSchema,
  foodLogBatchSchema,
  nutritionSearchSchema,
} from '@/lib/validations/food';
import { weightEntrySchema } from '@/lib/validations/progress';

const VALID_PROFILE = {
  full_name: 'Alex Kim',
  age: 30,
  gender: 'female',
  height_cm: 165,
  weight_kg: 62,
  target_weight_kg: 58,
  activity_level: 'moderately_active',
  goal: 'lose_weight',
  dietary_preference: 'vegetarian',
  allergies: ['Peanut', 'peanut', ' Dairy '],
  food_preferences: ['paneer'],
  meals_per_day: 4,
};

describe('profileSchema', () => {
  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it('coerces numbers from form strings', () => {
    const parsed = profileSchema.parse({
      ...VALID_PROFILE,
      age: '30',
      height_cm: '165',
      weight_kg: '62',
      meals_per_day: '4',
    });

    expect(parsed.age).toBe(30);
    expect(parsed.height_cm).toBe(165);
  });

  it('lowercases and de-duplicates tag lists', () => {
    const parsed = profileSchema.parse(VALID_PROFILE);
    expect(parsed.allergies).toEqual(['peanut', 'dairy']);
  });

  it('rejects an age under 13', () => {
    const result = profileSchema.safeParse({ ...VALID_PROFILE, age: 10 });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range height', () => {
    expect(profileSchema.safeParse({ ...VALID_PROFILE, height_cm: 30 }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...VALID_PROFILE, height_cm: 300 }).success).toBe(
      false,
    );
  });

  it('rejects an empty name', () => {
    expect(profileSchema.safeParse({ ...VALID_PROFILE, full_name: '  ' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown enum value', () => {
    expect(
      profileSchema.safeParse({ ...VALID_PROFILE, goal: 'become_immortal' }).success,
    ).toBe(false);
  });

  it('treats a null target weight as absent', () => {
    const parsed = profileSchema.parse({ ...VALID_PROFILE, target_weight_kg: null });
    expect(parsed.target_weight_kg).toBeNull();
  });

  it('bounds meals per day to 2-6', () => {
    expect(profileSchema.safeParse({ ...VALID_PROFILE, meals_per_day: 1 }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...VALID_PROFILE, meals_per_day: 7 }).success).toBe(
      false,
    );
  });
});

describe('auth schemas', () => {
  it('requires a valid email', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('requires at least 8 characters on signup', () => {
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'short' }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'longenough' }).success,
    ).toBe(true);
  });

  it('does not impose a length rule at sign-in, only presence', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(
      true,
    );
  });
});

describe('foodLogSchema', () => {
  const VALID_LOG = {
    log_date: '2026-08-15',
    meal_type: 'lunch',
    food_name: 'Grilled chicken',
    grams: 150,
    calories: 248,
    protein_g: 46.5,
    carbs_g: 0,
    fat_g: 5.4,
  };

  it('accepts a valid entry and applies defaults', () => {
    const parsed = foodLogSchema.parse(VALID_LOG);
    expect(parsed.quantity).toBe(1);
    expect(parsed.nutrition_source).toBe('manual');
    expect(parsed.image_url).toBeNull();
  });

  it('rejects a malformed date', () => {
    expect(
      foodLogSchema.safeParse({ ...VALID_LOG, log_date: '15/08/2026' }).success,
    ).toBe(false);
  });

  it('rejects a zero or negative portion', () => {
    expect(foodLogSchema.safeParse({ ...VALID_LOG, grams: 0 }).success).toBe(false);
    expect(foodLogSchema.safeParse({ ...VALID_LOG, grams: -5 }).success).toBe(false);
  });

  it('rejects an implausibly large portion', () => {
    expect(foodLogSchema.safeParse({ ...VALID_LOG, grams: 99999 }).success).toBe(false);
  });

  it('rejects negative nutrition', () => {
    expect(foodLogSchema.safeParse({ ...VALID_LOG, calories: -100 }).success).toBe(
      false,
    );
  });

  it('rejects an empty food name', () => {
    expect(foodLogSchema.safeParse({ ...VALID_LOG, food_name: '   ' }).success).toBe(
      false,
    );
  });

  it('bounds confidence to 0-1', () => {
    expect(foodLogSchema.safeParse({ ...VALID_LOG, confidence: 1.5 }).success).toBe(
      false,
    );
    expect(foodLogSchema.safeParse({ ...VALID_LOG, confidence: 0.82 }).success).toBe(
      true,
    );
  });

  it('requires at least one item in a batch and caps the batch size', () => {
    expect(foodLogBatchSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      foodLogBatchSchema.safeParse({
        items: Array.from({ length: 21 }, () => VALID_LOG),
      }).success,
    ).toBe(false);
    expect(foodLogBatchSchema.safeParse({ items: [VALID_LOG] }).success).toBe(true);
  });
});

describe('nutritionSearchSchema', () => {
  it('requires at least 2 characters', () => {
    expect(nutritionSearchSchema.safeParse({ q: 'a' }).success).toBe(false);
  });

  it('defaults the limit', () => {
    expect(nutritionSearchSchema.parse({ q: 'rice' }).limit).toBe(10);
  });

  it('caps the limit', () => {
    expect(nutritionSearchSchema.safeParse({ q: 'rice', limit: 500 }).success).toBe(
      false,
    );
  });
});

describe('weightEntrySchema', () => {
  it('accepts a valid weigh-in', () => {
    expect(
      weightEntrySchema.safeParse({ entry_date: '2026-08-15', weight_kg: 70.5 }).success,
    ).toBe(true);
  });

  it('rejects an out-of-range weight', () => {
    expect(
      weightEntrySchema.safeParse({ entry_date: '2026-08-15', weight_kg: 5 }).success,
    ).toBe(false);
  });

  it('normalises an empty note to null', () => {
    const parsed = weightEntrySchema.parse({
      entry_date: '2026-08-15',
      weight_kg: 70,
      note: '   ',
    });
    expect(parsed.note).toBeNull();
  });
});
