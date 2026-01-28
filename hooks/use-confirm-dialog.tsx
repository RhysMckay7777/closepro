'use client';

import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);

  const openDialog = useCallback((c: ConfirmDialogConfig) => {
    setConfig(c);
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (config?.onConfirm) {
      await config.onConfirm();
    }
    setOpen(false);
    setConfig(null);
  }, [config]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setConfig(null);
  }, []);

  function ConfirmDialogComponent() {
    if (!config) return null;
    return (
      <AlertDialog open={open} onOpenChange={(o) => !o && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
            <AlertDialogDescription>{config.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{config.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className={config.variant === 'destructive' ? buttonVariants({ variant: 'destructive' }) : undefined}
            >
              {config.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return { openDialog, ConfirmDialog: ConfirmDialogComponent };
}
