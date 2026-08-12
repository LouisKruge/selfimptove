export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="border-b border-line pb-6">
        <div className="h-2 w-24 bg-line" />
        <div className="mt-4 h-8 w-64 bg-line-soft" />
      </div>
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel p-5">
            <div className="h-2 w-16 bg-line" />
            <div className="mt-4 h-7 w-24 bg-line-soft" />
          </div>
        ))}
      </div>
      <div className="panel h-48" />
    </div>
  );
}
