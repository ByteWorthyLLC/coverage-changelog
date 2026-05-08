interface SkeletonProps {
  width?: string
  height?: string
  className?: string
  radius?: string
}

export function Skeleton({ width = '100%', height = '1rem', className = '', radius = 'var(--radius-sm)' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

export function DatasetSkeleton() {
  return (
    <main className="app-frame" aria-busy="true" aria-live="polite">
      <header className="top-bar">
        <div>
          <Skeleton width="160px" height="0.7rem" />
          <Skeleton width="min(620px, 80vw)" height="2.4rem" />
        </div>
        <div className="top-actions">
          <Skeleton width="84px" height="44px" radius="var(--radius-md)" />
          <Skeleton width="84px" height="44px" radius="var(--radius-md)" />
          <Skeleton width="84px" height="44px" radius="var(--radius-md)" />
        </div>
      </header>
      <section className="command-center" aria-hidden="true">
        <div className="signal-panel">
          <Skeleton width="40%" height="0.7rem" />
          <Skeleton width="70%" height="1.5rem" />
          <Skeleton width="100%" height="3rem" />
          <div className="signal-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <Skeleton width="50%" height="2rem" />
                <Skeleton width="80%" height="0.7rem" />
              </div>
            ))}
          </div>
        </div>
        <div className="brief-panel">
          <Skeleton width="50%" height="1rem" />
          <Skeleton width="100%" height="0.9rem" />
          <Skeleton width="92%" height="0.9rem" />
          <Skeleton width="86%" height="0.9rem" />
          <Skeleton width="78%" height="0.9rem" />
        </div>
      </section>
      <section className="toolbar">
        <Skeleton width="320px" height="44px" radius="var(--radius-md)" />
      </section>
      <section className="radar-grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="analysis-panel" aria-hidden="true">
            <Skeleton width="40%" height="0.9rem" />
            <Skeleton width="100%" height="6rem" />
          </div>
        ))}
      </section>
    </main>
  )
}
