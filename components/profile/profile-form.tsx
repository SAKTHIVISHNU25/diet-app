'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/types/user';
import { saveProfile, type ProfileActionState } from '@/app/(dashboard)/profile/actions';
import { Button } from '@/components/ui/button';
import {
  AboutYouFields,
  FoodPreferenceFields,
  GoalsFields,
} from '@/components/profile/profile-fields';

const INITIAL: ProfileActionState = {};

/** Flat (non-stepped) profile editor — all fields at once. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveProfile, INITIAL);

  useEffect(() => {
    if (state.ok) {
      toast.success('Profile updated. Your targets have been recalculated.');
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="mt-5 space-y-6" noValidate>
      <AboutYouFields profile={profile} errors={state.fieldErrors} />
      <GoalsFields profile={profile} errors={state.fieldErrors} />
      <FoodPreferenceFields profile={profile} errors={state.fieldErrors} />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}
