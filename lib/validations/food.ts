import { z } from 'zod';

export const mealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'snack',
  'dinner',
  'other',
]);

export const nutritionSourceSchema = z.enum(['usda', 'manual', 'cache', 'estimate']);

/** ISO date (YYYY-MM-DD) as stored in the `date` columns. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const foodLogSchema = z.object({
  log_date: isoDateSchema,
  meal_type: mealTypeSchema,
  food_name: z
    .string()
    .trim()
    .min(1, 'Please enter a food name')
    .max(120, 'Food name is too long'),
  quantity: z.coerce.number().positive().max(99).default(1),
  grams: z.coerce
    .number()
    .positive('Portion must be greater than 0')
    .max(5000, 'Portion must be under 5000 g'),
  calories: z.coerce.number().min(0).max(20000),
  protein_g: z.coerce.number().min(0).max(2000),
  carbs_g: z.coerce.number().min(0).max(2000),
  fat_g: z.coerce.number().min(0).max(2000),
  image_url: z.string().url().nullable().optional().default(null),
  nutrition_source: nutritionSourceSchema.default('manual'),
  fdc_id: z.string().max(40).nullable().optional().default(null),
  confidence: z.coerce.number().min(0).max(1).nullable().optional().default(null),
});

export type FoodLogInput = z.infer<typeof foodLogSchema>;

export const foodLogUpdateSchema = foodLogSchema.partial();
export type FoodLogUpdateInput = z.infer<typeof foodLogUpdateSchema>;

/** Body accepted by POST /api/food/log — a batch of items from the scan review. */
export const foodLogBatchSchema = z.object({
  items: z
    .array(foodLogSchema)
    .min(1, 'Nothing to log')
    .max(20, 'Too many items in one request'),
});

/** Query for GET /api/nutrition/search. */
export const nutritionSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Search for at least 2 characters')
    .max(80, 'Search term is too long'),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/**
 * Image constraints shared by the client and the analyze route.
 * Kept in sync with the size limit in storage.rules.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const imageFileSchema = z
  .instanceof(File, { message: 'Please choose an image file' })
  .refine((file) => file.size > 0, 'The image file is empty')
  .refine(
    (file) => file.size <= MAX_IMAGE_BYTES,
    `Image must be smaller than ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`,
  )
  .refine(
    (file) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
    'Image must be a JPEG, PNG or WebP file',
  );
