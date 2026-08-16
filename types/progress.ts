export interface WeightEntry {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressSummary {
  startingWeight: number | null;
  currentWeight: number | null;
  goalWeight: number | null;
  /** currentWeight - startingWeight. Negative means weight lost. */
  change: number | null;
  /** Remaining distance to the goal weight, signed the same way as `change`. */
  toGoal: number | null;
  entryCount: number;
}
