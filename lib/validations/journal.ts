import { z } from 'zod';
import { isoDateSchema } from './food';
import { JOURNAL_MOODS, REFLECTION_FIELDS } from '@/types/journal';

export const journalMoodSchema = z.enum(JOURNAL_MOODS);

/** Each part of the three-part review: optional, trimmed, empty becomes null. */
const reflectionFieldSchema = z
  .string()
  .trim()
  .max(1000, 'That section is too long')
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const journalEntryFields = z.object({
  entry_date: isoDateSchema,
  mood: journalMoodSchema
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  content: z
    .string()
    .trim()
    .max(5000, 'Entry is too long')
    .optional()
    .transform((v) => v ?? ''),
  went_well: reflectionFieldSchema,
  went_wrong: reflectionFieldSchema,
  to_improve: reflectionFieldSchema,
});

/**
 * A day is worth storing if *something* was written — free text, or any part
 * of the review. Requiring `content` would block a reflection-only day, and
 * requiring nothing would let an empty tap create a blank entry that still
 * counts towards the streak.
 */
export const journalEntrySchema = journalEntryFields.refine(
  (entry) =>
    Boolean(entry.content) || REFLECTION_FIELDS.some((field) => entry[field]),
  { message: 'Write something before saving', path: ['content'] },
);

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

/**
 * Partial update. The "not empty" rule is deliberately absent: a PATCH carries
 * only the fields being changed, and the record it merges into already has
 * content. Clearing every field at once is handled by deleting the entry.
 */
export const journalEntryUpdateSchema = journalEntryFields.partial();
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdateSchema>;
