'use client';

import { useTour } from './tour-provider';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function TourStepCard() {
  const { isOpen, steps, currentIndex, next, prev, skip, complete } = useTour();

  if (!isOpen) return null;

  const step = steps[currentIndex];
  if (!step) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <div className="fixed bottom-6 left-1/2 z-[101] -translate-x-1/2 w-full max-w-md px-4 pointer-events-auto">
      <Card className="border-2 border-primary/30 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {currentIndex + 1} of {steps.length}
            </span>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8" onClick={skip}>
              Skip tour
            </Button>
          </div>
          <h3 className="text-lg font-semibold">{step.title}</h3>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </CardContent>
        <CardFooter className="flex gap-2 pt-4">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={prev}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" onClick={isLast ? complete : next}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
