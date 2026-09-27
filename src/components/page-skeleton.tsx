// Shown instantly while a page's data loads, so navigation never feels frozen.
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  const bar = "animate-pulse rounded-md bg-line/70";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className={`${bar} h-3 w-32`} />
        <div className={`${bar} h-9 w-72 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-4 h-7 w-32`} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className={`${bar} h-4 w-40`} />
        <div className={`${bar} mt-4 h-48 w-full`} />
      </div>
    </div>
  );
}
