'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveProfile, type ProfileActionState } from '@/app/(dashboard)/profile/actions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AboutYouFields,
  FoodPreferenceFields,
  GoalsFields,
} from '@/components/profile/profile-fields';

const STEPS = [
  { title: 'About you', description: 'Used to estimate your metabolic rate.' },
  { title: 'Your goal', description: 'How we adjust your calorie target.' },
  { title: 'Food preferences', description: 'Shapes your 7-day diet plan.' },
] as const;

const INITIAL: ProfileActionState = {};

/**
 * Three-step onboarding.
 *
 * All fields live in a single form the whole time; steps only control which
 * group is visible. Hiding rather than unmounting means every value is still
 * present in the FormData when the last step submits, with no client state to
 * keep in sync.
 */
export function OnboardingForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(saveProfile, INITIAL);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (state.ok) {
      toast.success('Profile saved. Here are your targets.');
      router.push('/dashboard');
    }
  }, [state.ok, router]);

  // A validation error can belong to an earlier step — jump back to it.
  useEffect(() => {
    if (!state.fieldErrors) return;
    const keys = Object.keys(state.fieldErrors);
    const stepOf = (key: string) =>
      ['full_name', 'age', 'gender', 'height_cm', 'weight_kg'].includes(key)
        ? 0
        : ['activity_level', 'goal', 'target_weight_kg'].includes(key)
          ? 1
          : 2;
    const earliest = Math.min(...keys.map(stepOf));
    setStep(earliest);
  }, [state.fieldErrors]);

  const isLastStep = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <form action={formAction} className="mt-6" noValidate>
      <Progress
        value={((step + 1) / STEPS.length) * 100}
        aria-label={`Step ${step + 1} of ${STEPS.length}`}
      />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="mt-1 text-lg font-semibold">{current.title}</h2>
      <p className="mb-5 text-sm text-muted-foreground">{current.description}</p>

      <div hidden={step !== 0}>
        <AboutYouFields errors={state.fieldErrors} />
      </div>
      <div hidden={step !== 1}>
        <GoalsFields errors={state.fieldErrors} />
      </div>
      <div hidden={step !== 2}>
        <FoodPreferenceFields errors={state.fieldErrors} />
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft aria-hidden />
            Back
          </Button>
        ) : null}

        {isLastStep ? (
          <SubmitButton />
        ) : (
          <Button
            type="button"
            size="lg"
            className="flex-1"
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="flex-1" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? 'Saving…' : 'Finish setup'}
    </Button>
  );
}
