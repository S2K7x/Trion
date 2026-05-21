export default function Loading() {
  return (
    <main
      className="overflow-y-auto flex flex-col gap-5 px-6 py-7"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
        {/* Back button placeholder */}
        <div
          className="h-4 w-28 rounded animate-pulse"
          style={{ background: 'var(--border-2)' }}
        />

        {/* Severity banner skeleton */}
        <div
          className="rounded-[12px] h-16 animate-pulse"
          style={{ background: 'var(--border-2)' }}
        />

        {/* Card skeletons */}
        {[120, 100, 80].map((h, i) => (
          <div
            key={i}
            className="rounded-[12px] animate-pulse"
            style={{ background: 'var(--surface)', height: h, border: '1px solid var(--border)' }}
          />
        ))}

        {/* Technical details skeleton */}
        <div
          className="rounded-[12px] h-12 animate-pulse"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        />
      </div>
    </main>
  )
}
