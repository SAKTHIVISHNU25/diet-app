import Link from 'next/link';
import { MyLyfLogo } from '@/components/shared/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 self-start rounded-lg">
        <MyLyfLogo />
      </Link>
      {children}
    </main>
  );
}
