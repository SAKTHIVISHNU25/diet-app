'use client';

import {
  ACTIVITY_LEVEL_HINTS,
  ACTIVITY_LEVEL_LABELS,
  DIETARY_PREFERENCE_LABELS,
  GENDER_LABELS,
  GOAL_LABELS,
  type ActivityLevel,
  type DietaryPreference,
  type GoalType,
  type Profile,
} from '@/types/user';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormError } from '@/components/shared/form-error';

export type FieldErrors = Record<string, string> | undefined;

interface StepProps {
  profile?: Profile | null;
  errors: FieldErrors;
}

/**
 * The profile form is split into three field groups, reused by both the
 * onboarding wizard (one group per step) and the profile editor (all at once).
 *
 * Each Select is given a `name`, which makes Radix render a hidden native
 * select alongside it so the value is submitted with the form. That keeps the
 * whole form uncontrolled — no state, no controlled-input churn on mobile.
 */

export function AboutYouFields({ profile, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile?.full_name ?? ''}
          autoComplete="name"
          required
          aria-invalid={Boolean(errors?.full_name)}
        />
        <FormError message={errors?.full_name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={120}
            defaultValue={profile?.age ?? ''}
            required
            aria-invalid={Boolean(errors?.age)}
          />
          <FormError message={errors?.age} />
        </div>

        <SelectField
          name="gender"
          label="Gender"
          defaultValue={profile?.gender ?? 'female'}
          options={Object.entries(GENDER_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          error={errors?.gender}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="height_cm">Height (cm)</Label>
          <Input
            id="height_cm"
            name="height_cm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={80}
            max={260}
            defaultValue={profile?.height_cm ?? ''}
            required
            aria-invalid={Boolean(errors?.height_cm)}
          />
          <FormError message={errors?.height_cm} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input
            id="weight_kg"
            name="weight_kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={25}
            max={400}
            defaultValue={profile?.weight_kg ?? ''}
            required
            aria-invalid={Boolean(errors?.weight_kg)}
          />
          <FormError message={errors?.weight_kg} />
        </div>
      </div>
    </div>
  );
}

export function GoalsFields({ profile, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <SelectField
        name="activity_level"
        label="Activity level"
        defaultValue={profile?.activity_level ?? 'sedentary'}
        options={(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map(
          (value) => ({
            value,
            label: ACTIVITY_LEVEL_LABELS[value],
            hint: ACTIVITY_LEVEL_HINTS[value],
          }),
        )}
        error={errors?.activity_level}
      />

      <SelectField
        name="goal"
        label="Goal"
        defaultValue={profile?.goal ?? 'maintain_weight'}
        options={(Object.keys(GOAL_LABELS) as GoalType[]).map((value) => ({
          value,
          label: GOAL_LABELS[value],
        }))}
        error={errors?.goal}
      />

      <div className="space-y-2">
        <Label htmlFor="target_weight_kg">Target weight (kg, optional)</Label>
        <Input
          id="target_weight_kg"
          name="target_weight_kg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={25}
          max={400}
          defaultValue={profile?.target_weight_kg ?? ''}
          aria-invalid={Boolean(errors?.target_weight_kg)}
        />
        <FormError message={errors?.target_weight_kg} />
      </div>
    </div>
  );
}

export function FoodPreferenceFields({ profile, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <SelectField
        name="dietary_preference"
        label="Dietary preference"
        defaultValue={profile?.dietary_preference ?? 'vegetarian'}
        options={(Object.keys(DIETARY_PREFERENCE_LABELS) as DietaryPreference[]).map(
          (value) => ({ value, label: DIETARY_PREFERENCE_LABELS[value] }),
        )}
        error={errors?.dietary_preference}
      />

      <SelectField
        name="meals_per_day"
        label="Meals per day"
        defaultValue={String(profile?.meals_per_day ?? 4)}
        options={[2, 3, 4, 5, 6].map((n) => ({
          value: String(n),
          label: `${n} meals`,
        }))}
        error={errors?.meals_per_day}
      />

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Input
          id="allergies"
          name="allergies"
          defaultValue={(profile?.allergies ?? []).join(', ')}
          placeholder="peanut, dairy, shellfish"
          aria-describedby="allergies-hint"
        />
        <p id="allergies-hint" className="text-xs text-muted-foreground">
          Comma separated. Foods matching these are excluded from your diet plan.
        </p>
        <FormError message={errors?.allergies} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="food_preferences">Foods you enjoy</Label>
        <Input
          id="food_preferences"
          name="food_preferences"
          defaultValue={(profile?.food_preferences ?? []).join(', ')}
          placeholder="paneer, oats, salmon"
          aria-describedby="preferences-hint"
        />
        <p id="preferences-hint" className="text-xs text-muted-foreground">
          Comma separated. These are favoured when building your plan.
        </p>
        <FormError message={errors?.food_preferences} />
      </div>
    </div>
  );
}

interface SelectFieldProps {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string; hint?: string }[];
  error?: string;
}

export function SelectField({
  name,
  label,
  defaultValue,
  options,
  error,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-trigger`}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={`${name}-trigger`} aria-invalid={Boolean(error)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex flex-col items-start">
                <span>{option.label}</span>
                {option.hint ? (
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormError message={error} />
    </div>
  );
}
