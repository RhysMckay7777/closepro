'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { useTour } from './tour-provider';

export function TourAutoStart() {
  const pathname = usePathname();
  const { user } = useUser();
  const { start, isOpen } = useTour();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (pathname !== '/dashboard' || user?.isTourCompleted !== false || isOpen || hasStarted.current) return;
    hasStarted.current = true;
    start();
  }, [pathname, user?.isTourCompleted, isOpen, start]);

  return null;
}
