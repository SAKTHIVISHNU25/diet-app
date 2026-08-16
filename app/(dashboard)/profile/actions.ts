'use server';

import { revalidatePath } from 'next/cache';
import { ServerValue } from 'firebase-admin/database';
import { adminDb, PATHS } from '@/lib/firebase/admin';
import { stripUndefined } from '@/lib/firebase/converters';
import { getUserId } from '@/lib/firebase/server';
import { profileSchema } from '@/lib/validations/profile';

export interface ProfileActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Creates or updates the signed-in user's profile.
 *
 * The write path is built from the verified session's uid — never from the
 * form — so a crafted request cannot write to someone else's profile.
 */
export async function saveProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const uid = await getUserId();
  if (!uid) return { error: 'Your session has expired. Please sign in again.' };

  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name'),
    age: formData.get('age'),
    gender: formData.get('gender'),
    height_cm: formData.get('height_cm'),
    weight_kg: formData.get('weight_kg'),
    target_weight_kg: formData.get('target_weight_kg') || null,
    activity_level: formData.get('activity_level'),
    goal: formData.get('goal'),
    dietary_preference: formData.get('dietary_preference'),
    allergies: parseTags(formData.get('allergies')),
    food_preferences: parseTags(formData.get('food_preferences')),
    meals_per_day: formData.get('meals_per_day'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  try {
    const ref = adminDb().ref(PATHS.profile(uid));
    const existing = await ref.get();
    const existingRow = (existing.val() ?? {}) as Record<string, unknown>;

    // The baseline is written once and then left alone — editing your current
    // weight here corrects today's number, it does not rewrite where you began.
    const existingBaseline = existingRow.starting_weight_kg;
    const startingWeight =
      typeof existingBaseline === 'number' && Number.isFinite(existingBaseline)
        ? existingBaseline
        : parsed.data.weight_kg;

    await ref.update(
      stripUndefined({
        ...parsed.data,
        starting_weight_kg: startingWeight,
        onboarded: true,
        created_at: existing.exists()
          ? (existingRow.created_at ?? ServerValue.TIMESTAMP)
          : ServerValue.TIMESTAMP,
        updated_at: ServerValue.TIMESTAMP,
      }),
    );
  } catch (error) {
    console.error('[action:saveProfile]', error);
    return { error: 'Could not save your profile. Please try again.' };
  }

  // Targets are derived from the profile, so anything showing them is stale.
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Comma-separated free text -> a clean tag array. */
function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 25);
}
