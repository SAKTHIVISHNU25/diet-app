import type { ReflectionField } from '@/types/journal';

/**
 * Writing prompts for the journal.
 *
 * A blank textarea is the reason most food journals die on day three, so the
 * editor always opens with one concrete question. They lean towards eating,
 * energy and habit rather than generic reflection — this is a diet journal,
 * and a prompt people can answer in one sentence is one they will answer.
 */
export const JOURNAL_PROMPTS = [
  'What did you eat today that you actually enjoyed?',
  'When were you hungriest, and what was going on around then?',
  'What made sticking to your plan easy — or hard — today?',
  'How was your energy through the day?',
  'Did anything trigger eating that was not hunger?',
  'What would you repeat tomorrow?',
  'How did you feel after your biggest meal?',
  'What got in the way of moving today?',
  'Which choice today are you glad you made?',
  'How well did you sleep, and did it show up in your appetite?',
  'What is one small thing you would change about today?',
  'Did you drink enough water? What made that easy or hard?',
  'What did you say no to today, and how did that feel?',
  'Which meal filled you up the longest?',
  'What is worth remembering about today, food aside?',
] as const;

/**
 * A stable prompt for a given day.
 *
 * Deterministic on purpose: the server and the client must land on the same
 * question or the page would flicker on hydration, and the prompt would change
 * under someone mid-sentence. `offset` steps to the next prompt, which is what
 * the shuffle button in the editor does.
 */
export function promptForDate(isoDate: string, offset = 0): string {
  let hash = 0;
  for (let index = 0; index < isoDate.length; index += 1) {
    hash = (hash * 31 + isoDate.charCodeAt(index)) % 100_000;
  }

  const position = (hash + offset) % JOURNAL_PROMPTS.length;
  return JOURNAL_PROMPTS[position] ?? JOURNAL_PROMPTS[0];
}

/**
 * One-tap answers for each review section.
 *
 * Typing three paragraphs on a phone at 11pm is how a review habit dies. These
 * cover the answers that recur most in a diet journal, so a full review can be
 * three taps on the days when writing is too much — and they seed the text
 * rather than replacing it, so anything specific still gets written.
 */
export const REFLECTION_SUGGESTIONS: Record<ReflectionField, readonly string[]> = {
  went_well: [
    'Hit my protein target',
    'Cooked at home',
    'Walked after dinner',
    'Stopped when full',
    'Drank enough water',
  ],
  went_wrong: [
    'Late-night snacking',
    'Skipped a meal',
    'Unplanned takeaway',
    'Sugary drinks',
    'Portions crept up',
  ],
  to_improve: [
    'Prep lunch tonight',
    'Eat more slowly',
    'More veg at dinner',
    'Walk 20 minutes',
    'Sleep earlier',
  ],
};
