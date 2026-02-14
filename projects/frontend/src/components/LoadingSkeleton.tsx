interface LoadingSkeletonProps {
  rows?: number
  compact?: boolean
}

export const LoadingSkeleton = ({ rows = 3, compact = false }: LoadingSkeletonProps) => (
  <div className={`skeleton-wrap${compact ? ' compact' : ''}`}>
    {Array.from({ length: rows }).map((_, idx) => (
      <div className="skeleton" key={idx} />
    ))}
  </div>
)
