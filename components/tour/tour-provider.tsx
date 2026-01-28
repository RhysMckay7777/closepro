'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useUser } from '@/contexts/user-context';
import { DASHBOARD_TOUR_STEPS, type TourStep } from './steps';

interface TourContextValue {
  steps: TourStep[];
  currentIndex: number;
  isOpen: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { markTourComplete } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const start = useCallback(() => {
    setCurrentIndex(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => {
      if (i >= DASHBOARD_TOUR_STEPS.length - 1) {
        setIsOpen(false);
        void markTourComplete();
        return i;
      }
      return i + 1;
    });
  }, [markTourComplete]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    setIsOpen(false);
    void markTourComplete();
  }, [markTourComplete]);

  const complete = useCallback(() => {
    setIsOpen(false);
    void markTourComplete();
  }, [markTourComplete]);

  const value = useMemo<TourContextValue>(
    () => ({
      steps: DASHBOARD_TOUR_STEPS,
      currentIndex,
      isOpen,
      start,
      next,
      prev,
      skip,
      complete,
    }),
    [currentIndex, isOpen, start, next, prev, skip, complete]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
