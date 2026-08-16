'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/firebase/auth-client';

/**
 * Signs out of both Firebase and the server session.
 *
 * Client-side rather than a Server Action, because the Firebase client SDK
 * holds its own persisted session that must be cleared too — otherwise the next
 * page load would silently re-authenticate.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <LogOut aria-hidden />
      )}
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
