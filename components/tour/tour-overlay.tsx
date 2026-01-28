'use client';

import { useEffect, useState } from 'react';
import { useTour } from './tour-provider';

const PAD = 8;

export function TourOverlay() {
  const { isOpen, steps, currentIndex } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[currentIndex];
  useEffect(() => {
    if (!isOpen || !step) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const update = () => setRect(el.getBoundingClientRect());
      update();
      const obs = new ResizeObserver(update);
      obs.observe(el);
      const onScroll = () => update();
      window.addEventListener('scroll', onScroll, true);
      return () => {
        obs.disconnect();
        window.removeEventListener('scroll', onScroll, true);
      };
    }
    setRect(null);
  }, [isOpen, step, currentIndex]);

  if (!isOpen) return null;

  const r = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return (
    <div className="fixed inset-0 z-[100]" aria-modal aria-label="Product tour">
      {r ? (
        <>
          {/* Dark bands around highlight */}
          <div className="absolute left-0 top-0 w-full bg-black/50" style={{ height: r.top }} />
          <div className="absolute left-0 bg-black/50" style={{ top: r.top, width: r.left, height: r.height }} />
          <div className="absolute bg-black/50" style={{ top: r.top, left: r.left + r.width, width: vw - r.left - r.width, height: r.height }} />
          <div className="absolute left-0 w-full bg-black/50" style={{ top: r.top + r.height, height: vh - r.top - r.height }} />
          <div
            className="absolute border-2 border-primary rounded-lg shadow-lg shadow-primary/20 box-border"
            style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}
    </div>
  );
}
