'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodCandidate } from '@/types/food';
import { MEAL_TYPE_LABELS, MEAL_TYPES, type MealType } from '@/types/meal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MacroDots } from '@/components/food/macro-dots';
import { calculateNutritionForGrams } from '@/lib/calculations/nutrition';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

interface FoodReviewProps {
  initialCandidates: FoodCandidate[];
  date: string;
  notes?: string;
  alternatives: { name: string; confidence: number }[];
  onStartOver: () => void;
  onOpenSearch: () => void;
}

/**
 * Review and correct what was recognised, then log it.
 *
 * Nothing reaches the food log until the user presses save — every value here
 * is editable, including ones the model produced.
 */
export function FoodReview({
  initialCandidates,
  date,
  notes,
  alternatives,
  onStartOver,
  onOpenSearch,
}: FoodReviewProps) {
  const router = useRouter();
  const [items, setItems] = useState<FoodCandidate[]>(initialCandidates);
  const [mealType, setMealType] = useState<MealType>(() => guessMealType());
  const [saving, setSaving] = useState(false);

  // Recognition results arrive after this component mounts.
  useEffect(() => setItems(initialCandidates), [initialCandidates]);

  function update(id: string, patch: Partial<FoodCandidate>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function addBlank() {
    setItems((current) => [
      ...current,
      {
        id: `blank-${Date.now()}`,
        name: '',
        grams: 100,
        nutrition: null,
        source: 'manual',
        needsNutrition: true,
      },
    ]);
  }

  const ready = items.filter((item) => item.name.trim() && item.nutrition);
  const incomplete = items.filter((item) => item.name.trim() && !item.nutrition);

  async function save() {
    if (ready.length === 0) {
      toast.error('Add at least one food with nutrition values before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: ready.map((item) => {
          const nutrition = calculateNutritionForGrams(item.nutrition!, item.grams);
          return {
            log_date: date,
            meal_type: mealType,
            food_name: item.name.trim(),
            quantity: item.quantity ?? 1,
            grams: item.grams,
            ...nutrition,
            // Meal photos are used for recognition only, never stored — the
            // app has no photo history, so there is nothing to display.
            image_url: null,
            nutrition_source: item.source,
            fdc_id: item.fdcId ?? null,
            confidence: item.confidence ?? null,
          };
        }),
      };

      const response = await fetch('/api/food/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save to your log.'));
        return;
      }

      toast.success(
        ready.length === 1
          ? `Added ${ready[0]!.name} to ${MEAL_TYPE_LABELS[mealType]}`
          : `Added ${ready.length} foods to ${MEAL_TYPE_LABELS[mealType]}`,
      );
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {items.length > 0 ? 'Food detected' : 'Add a food'}
        </h2>
        <Button variant="ghost" size="sm" onClick={onStartOver}>
          <RotateCcw aria-hidden />
          Start over
        </Button>
      </div>

      {notes ? <p className="mt-1 text-sm text-muted-foreground">{notes}</p> : null}

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <CandidateCard
            key={item.id}
            item={item}
            alternatives={alternatives}
            onChange={(patch) => update(item.id, patch)}
            onRemove={() => remove(item.id)}
          />
        ))}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No food yet. Search the nutrition database or add one by hand.
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onOpenSearch} className="flex-1">
          <Search aria-hidden />
          Search food database
        </Button>
        <Button variant="outline" onClick={addBlank} className="flex-1">
          <Plus aria-hidden />
          Add another food
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor="meal-type">Add to</Label>
        <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
          <SelectTrigger id="meal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {MEAL_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {incomplete.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {incomplete.length} item{incomplete.length > 1 ? 's' : ''} still need
          nutrition values and won&apos;t be saved yet.
        </p>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Nutrition values are estimates. Adjust the portion if needed.
      </p>

      <Button
        size="lg"
        className="mt-3 w-full"
        onClick={save}
        disabled={saving || ready.length === 0}
      >
        {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {saving ? 'Saving…' : "Add to today's log"}
      </Button>
    </div>
  );
}

interface CandidateCardProps {
  item: FoodCandidate;
  alternatives: { name: string; confidence: number }[];
  onChange: (patch: Partial<FoodCandidate>) => void;
  onRemove: () => void;
}

function CandidateCard({ item, alternatives, onChange, onRemove }: CandidateCardProps) {
  const [lookingUp, setLookingUp] = useState(false);

  const nutrition = item.nutrition
    ? calculateNutritionForGrams(item.nutrition, item.grams)
    : null;

  /** Fetch nutrition for whatever name the user typed. */
  async function lookup() {
    const query = item.name.trim();
    if (query.length < 2) {
      toast.error('Enter a food name of at least 2 characters first.');
      return;
    }

    setLookingUp(true);
    try {
      const response = await fetch(
        `/api/nutrition/search?q=${encodeURIComponent(query)}&limit=1`,
      );

      if (!response.ok) {
        toast.error(await readApiError(response, 'No nutrition data found.'));
        return;
      }

      const data = (await response.json()) as {
        items: {
          name: string;
          caloriesPer100g: number;
          proteinPer100g: number;
          carbsPer100g: number;
          fatPer100g: number;
          fdcId?: string;
          source: FoodCandidate['source'];
        }[];
      };

      const match = data.items[0];
      if (!match) {
        toast.error('No nutrition data found for that food.');
        return;
      }

      onChange({
        nutrition: {
          caloriesPer100g: match.caloriesPer100g,
          proteinPer100g: match.proteinPer100g,
          carbsPer100g: match.carbsPer100g,
          fatPer100g: match.fatPer100g,
        },
        fdcId: match.fdcId,
        source: match.source,
        needsNutrition: false,
      });
      toast.success(`Matched "${match.name}"`);
    } catch {
      toast.error('Network problem while looking up nutrition.');
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor={`name-${item.id}`} className="text-xs text-muted-foreground">
              Food name
            </Label>
            <Input
              id={`name-${item.id}`}
              value={item.name}
              placeholder="e.g. Chicken biryani"
              onChange={(event) =>
                onChange({ name: event.target.value, needsNutrition: true })
              }
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${item.name || 'this item'}`}
            className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>

        {item.confidence !== undefined ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={item.confidence >= 0.6 ? 'success' : 'warning'}>
              Confidence: {Math.round(item.confidence * 100)}%
            </Badge>
            {item.estimatedPortion ? (
              <span className="text-xs text-muted-foreground">
                Portion: {item.estimatedPortion}
              </span>
            ) : null}
          </div>
        ) : null}

        {alternatives.length > 0 && item.confidence !== undefined ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Not right?</span>
            {alternatives.map((alt) => (
              <button
                key={alt.name}
                type="button"
                onClick={() => onChange({ name: alt.name, needsNutrition: true })}
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
              >
                {alt.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 items-end gap-2 sm:gap-3">
          <div className="space-y-2">
            <Label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground">
              Qty / Count
            </Label>
            <Input
              id={`qty-${item.id}`}
              type="number"
              inputMode="decimal"
              min={0.25}
              max={99}
              step={1}
              value={item.quantity ?? 1}
              onChange={(event) => {
                const newQty = Number.parseFloat(event.target.value);
                if (Number.isFinite(newQty) && newQty > 0) {
                  const currentQty = item.quantity || 1;
                  const unitGrams = item.grams / currentQty;
                  const newGrams = Math.round(unitGrams * newQty);
                  onChange({ quantity: newQty, grams: newGrams });
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`grams-${item.id}`} className="text-xs text-muted-foreground">
              Portion (g)
            </Label>
            <Input
              id={`grams-${item.id}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={5000}
              value={item.grams}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                onChange({ grams: Number.isFinite(value) && value > 0 ? value : 0 });
              }}
            />
          </div>

          <Button variant="outline" onClick={lookup} disabled={lookingUp} className="w-full">
            {lookingUp ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Search aria-hidden />
            )}
            {item.nutrition ? 'Re-check' : 'Get nutrition'}
          </Button>
        </div>

        {nutrition ? (
          <div className="mt-4 rounded-xl border bg-muted/40 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Calories
              </p>
              <p className="tabular mt-0.5 text-2xl font-semibold leading-none">
                {formatNumber(nutrition.calories)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  kcal
                </span>
              </p>
            </div>
            <MacroDots
              className="mt-3 border-t pt-3"
              protein={nutrition.protein_g}
              carbs={nutrition.carbs_g}
              fat={nutrition.fat_g}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            No nutrition data yet. Press &ldquo;Get nutrition&rdquo; or use the food
            database search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Sensible default meal based on the time of day. */
function guessMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}
