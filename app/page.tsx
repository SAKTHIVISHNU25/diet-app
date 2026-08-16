import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, LineChart, Salad, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MedicalDisclaimer } from '@/components/shared/medical-disclaimer';
import { getSessionUser } from '@/lib/firebase/server';

const FEATURES = [
  {
    icon: Camera,
    title: 'Scan your meal',
    body: 'Photograph a plate and get a food suggestion from an open-source model. You confirm the result before anything is logged.',
  },
  {
    icon: Salad,
    title: 'Personalised targets',
    body: 'Calorie and macro targets from your own BMR and activity level, using the Mifflin-St Jeor equation.',
  },
  {
    icon: LineChart,
    title: 'Track progress',
    body: 'Daily calories and macros, a full food history, and a weight trend over time.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    body: 'Your data is scoped to your account and protected by security rules. You only ever see your own records.',
  },
];

export default async function LandingPage() {
  // Signed-in users have no reason to see the marketing page.
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    // Firebase not configured yet — fall through and render the landing page.
  }
  if (user) redirect('/dashboard');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-10">
      <header className="flex-1">
        <div className="mb-10 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Salad className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Diet AI</span>
        </div>

        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Know what you eat, without the guesswork.
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Snap a photo of your meal, confirm what it is, and let Diet AI handle the
          calories and macros — with nutrition data from USDA FoodData Central.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">Create an account</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-2xl border bg-card p-5">
              <feature.icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 font-medium">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>
      </header>

      <footer className="mt-12">
        <MedicalDisclaimer />
      </footer>
    </main>
  );
}
