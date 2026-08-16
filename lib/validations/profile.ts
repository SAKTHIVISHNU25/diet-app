import { z } from 'zod';

export const genderSchema = z.enum(['male', 'female', 'other']);

export const activityLevelSchema = z.enum([
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
]);

export const goalSchema = z.enum(['lose_weight', 'maintain_weight', 'gain_weight']);

export const dietaryPreferenceSchema = z.enum([
  'vegetarian',
  'non_vegetarian',
  'vegan',
  'eggetarian',
]);

/** Free-text tags (allergies, food preferences). Trimmed, de-duplicated, capped. */
const tagListSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(25, 'Please keep the list to 25 items or fewer')
  .transform((tags) => Array.from(new Set(tags.map((t) => t.toLowerCase()))))
  .default([]);

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'Please enter your name')
    .max(80, 'Name is too long'),
  age: z.coerce
    .number()
    .int('Age must be a whole number')
    .min(13, 'You must be at least 13 to use this app')
    .max(120, 'Please enter a valid age'),
  gender: genderSchema,
  height_cm: z.coerce
    .number()
    .min(80, 'Height must be at least 80 cm')
    .max(260, 'Height must be under 260 cm'),
  weight_kg: z.coerce
    .number()
    .min(25, 'Weight must be at least 25 kg')
    .max(400, 'Weight must be under 400 kg'),
  target_weight_kg: z.coerce
    .number()
    .min(25)
    .max(400)
    .nullable()
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
  activity_level: activityLevelSchema,
  goal: goalSchema,
  dietary_preference: dietaryPreferenceSchema,
  allergies: tagListSchema,
  food_preferences: tagListSchema,
  meals_per_day: z.coerce
    .number()
    .int()
    .min(2, 'At least 2 meals per day')
    .max(6, 'At most 6 meals per day'),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Partial update — every field optional, same constraints when present. */
export const profileUpdateSchema = profileSchema.partial();
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const signUpSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be under 72 characters'),
});

export const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
