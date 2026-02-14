import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  right?: ReactNode
  children: ReactNode
}

export const Card = ({ title, right, children }: CardProps) => (
  <section className="card">
    {title || right ? (
      <div className="card-header">
        <h3>{title}</h3>
        {right}
      </div>
    ) : null}
    {children}
  </section>
)
