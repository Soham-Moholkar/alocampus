import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  body: string
  ctaLabel?: string
  ctaTo?: string
  extra?: ReactNode
}

export const EmptyState = ({ title, body, ctaLabel, ctaTo, extra }: EmptyStateProps) => (
  <div className="empty-state">
    <h3>{title}</h3>
    <p>{body}</p>
    {ctaLabel && ctaTo ? (
      <Link className="btn" to={ctaTo}>
        {ctaLabel}
      </Link>
    ) : null}
    {extra}
  </div>
)
