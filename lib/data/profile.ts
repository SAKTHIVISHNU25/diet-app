import 'server-only';

import { cache } from 'react';
import type { Profile } from '@/types/user';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { getUserId } from '@/lib/firebase/server';
import {
  toISOString,
  toNullableNumber,
  toNumber,
  toStringArray,
} from '@/lib/firebase/converters';

/**
 * Server-side data access for the signed-in user's profile.
 *
 * The profile lives at `profiles/{uid}`, so there is a 1:1 mapping with the
 * account. `cache` de-duplicates the read within a single render pass.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const uid = await getUserId();
  if (!uid) return null;

  try {
    const snapshot = await adminDb().ref(PATHS.profile(uid)).get();
    if (!snapshot.exists()) return null;
    return normalizeProfile(uid, snapshot.val());
  } catch (error) {
    console.error('[data:getProfile]', error);
    return null;
  }
});

/** Database node -> Profile, coercing every field defensively. */
export function normalizeProfile(id: string, data: unknown): Profile {
  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id,
    full_name: typeof row.full_name === 'string' ? row.full_name : '',
    age: toNumber(row.age),
    gender: (row.gender as Profile['gender']) ?? 'other',
    height_cm: toNumber(row.height_cm),
    weight_kg: toNumber(row.weight_kg),
    starting_weight_kg: toNullableNumber(row.starting_weight_kg),
    target_weight_kg: toNullableNumber(row.target_weight_kg),
    activity_level: (row.activity_level as Profile['activity_level']) ?? 'sedentary',
    goal: (row.goal as Profile['goal']) ?? 'maintain_weight',
    dietary_preference:
      (row.dietary_preference as Profile['dietary_preference']) ?? 'vegetarian',
    allergies: toStringArray(row.allergies),
    food_preferences: toStringArray(row.food_preferences),
    meals_per_day: toNumber(row.meals_per_day, 4),
    onboarded: row.onboarded === true,
    created_at: toISOString(row.created_at),
    updated_at: toISOString(row.updated_at),
  };
}
