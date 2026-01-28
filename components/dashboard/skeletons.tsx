import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-9 w-64 sm:w-80" />
        <Skeleton className="h-5 w-48 mt-2" />
      </div>
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <Card className="p-4 sm:p-6">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent className="p-0 space-y-1">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="p-4 sm:p-6">
        <CardHeader className="p-0 pb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function CardGridListSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-6">
            <div className="space-y-3 mb-4">
              <Skeleton className="h-6 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-9" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TableListSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <Card className="p-4">
        <div className="space-y-2 mb-4 flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded ml-auto" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function CallsPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <Skeleton className="h-24 flex-1 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </Card>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 max-w-xs" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Card className="p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-9 w-9" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </div>
      <Card className="p-4 sm:p-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-9 w-9" />
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40 mt-1" />
        </div>
      </div>
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </Card>
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-9 w-full mt-2" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function OfferDetailSkeleton() {
  return <DetailPageSkeleton />;
}

export function ProfilePageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-48 mt-1" />
      </div>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-9 w-24 mt-2" />
          </div>
        </div>
        <div className="space-y-4 border-t pt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <Card className="p-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-4 border-b last:border-0">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function TeamPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ManagerDashboardSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function BillingPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-4 w-20" />
        </Card>
        <Card className="p-4">
          <Skeleton className="h-5 w-28 mb-2" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-4 w-24" />
        </Card>
      </div>
    </div>
  );
}

export function CreateOrganizationSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-lg space-y-6">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-56 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
      </div>
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </Card>
    </div>
  );
}

export function RoleplaySessionSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
      <Card className="p-6 min-h-[320px]">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </Card>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  );
}

export function RoleplayResultsSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
      </div>
      <Card className="p-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40 mt-1" />
          </div>
          <Skeleton className="h-14 w-20" />
        </div>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-5 w-20 mb-2" />
            <Skeleton className="h-8 w-12" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ReviewPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 flex-1" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CallDetailSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9" />
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40 mt-1" />
        </div>
      </div>
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
      <Card className="p-4">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function RepDetailSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52 mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-14" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between py-2 border-b last:border-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function PerformanceSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-64 w-full" />
      </Card>
    </div>
  );
}

export function ManagerSubPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <Card className="p-6">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function PricingSkeleton() {
  return (
    <div className="space-y-8 mt-20 px-4">
      <div className="flex justify-start">
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-6 w-28 mx-auto rounded-full" />
        <Skeleton className="h-10 w-80 mx-auto" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-10 w-20 mb-4" />
            <div className="space-y-2 mb-6">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-11 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
