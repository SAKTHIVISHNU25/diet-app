'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Are-you-sure step for anything destructive.
 *
 * Deletes here are immediate and unrecoverable — there is no undo and no bin —
 * so a mis-tap on a small trash icon would silently cost real data. One tap to
 * confirm is cheap next to that.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = 'Delete this?',
  description,
  confirmLabel = 'Delete',
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm text-center data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <DialogHeader className="items-center pr-0 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Trash2 className="size-6" aria-hidden />
          </span>
          <DialogTitle className="pt-2">{title}</DialogTitle>
          <DialogDescription className="text-pretty">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="sm:flex-1"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
