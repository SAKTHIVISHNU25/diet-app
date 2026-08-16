'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodLog, MealType } from '@/types/meal';
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '@/types/meal';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { readApiError } from '@/lib/utils/fetch';

interface EditFoodLogSheetProps {
  log: FoodLog | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Edit a logged food.
 *
 * Changing the portion rescales calories and macros from the entry's own
 * per-gram values, so the numbers stay internally consistent without another
 * nutrition lookup.
 */
export function EditFoodLogSheet({ log, onOpenChange, onSaved }: EditFoodLogSheetProps) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [mealType, setMealType] = useState<MealType>('other');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!log) return;
    setName(log.food_name);
    setGrams(String(log.grams));
    setMealType(log.meal_type);
  }, [log]);

  if (!log) return null;

  const parsedGrams = Number.parseFloat(grams);
  const validGrams = Number.isFinite(parsedGrams) && parsedGrams > 0;

  // Per-gram values recovered from the original entry.
  const factor = validGrams ? parsedGrams / log.grams : 1;
  const preview = {
    calories: Math.round(log.calories * factor),
    protein_g: round1(log.protein_g * factor),
    carbs_g: round1(log.carbs_g * factor),
    fat_g: round1(log.fat_g * factor),
  };

  async function handleSave() {
    if (!log) return;
    if (!name.trim()) {
      toast.error('Please enter a food name.');
      return;
    }
    if (!validGrams) {
      toast.error('Please enter a portion greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_name: name.trim(),
          grams: parsedGrams,
          meal_type: mealType,
          ...preview,
        }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response, 'Could not save your changes.'));
        return;
      }

      toast.success('Updated');
      onSaved();
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(log)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Edit food</SheetTitle>
          <SheetDescription>
            Adjust the portion and we&apos;ll rescale the nutrition.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Food</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-grams">Portion (g)</Label>
              <Input
                id="edit-grams"
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-meal">Meal</Label>
              <Select
                value={mealType}
                onValueChange={(value) => setMealType(value as MealType)}
              >
                <SelectTrigger id="edit-meal">
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
          </div>

          <dl className="grid grid-cols-4 gap-2 rounded-xl bg-muted/60 p-3 text-center">
            <Stat label="kcal" value={preview.calories} />
            <Stat label="Protein" value={preview.protein_g} suffix="g" />
            <Stat label="Carbs" value={preview.carbs_g} suffix="g" />
            <Stat label="Fat" value={preview.fat_g} suffix="g" />
          </dl>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-sm font-medium">
        {value}
        {suffix}
      </dd>
    </div>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
