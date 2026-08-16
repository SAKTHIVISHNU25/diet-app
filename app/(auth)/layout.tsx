import Link from 'next/link';
import { Salad } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 self-start rounded-lg">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Salad className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Diet AI</span>
      </Link>
      {children}
    </main>
  );
}
