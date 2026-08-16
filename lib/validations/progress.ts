import { z } from 'zod';
import { isoDateSchema } from './food';

export const weightEntrySchema = z.object({
  entry_date: isoDateSchema,
  weight_kg: z.coerce
    .number()
    .min(25, 'Weight must be at least 25 kg')
    .max(400, 'Weight must be under 400 kg'),
  note: z
    .string()
    .trim()
    .max(200, 'Note is too long')
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export type WeightEntryInput = z.infer<typeof weightEntrySchema>;

export const weightEntryUpdateSchema = weightEntrySchema.partial();
export type WeightEntryUpdateInput = z.infer<typeof weightEntryUpdateSchema>;
