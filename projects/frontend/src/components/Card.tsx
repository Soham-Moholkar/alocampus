import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  right?: ReactNode
  className?: string
  children: ReactNode
}

export const Card = ({ title, subtitle, right, className, children }: CardProps) => (
  <section className={`card${className ? ` ${className}` : ''}`}>
    {title || right ? (
      <div className="card-header">
        <div className="card-heading">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {right}
      </div>
    ) : null}
    {children}
  </section>
)
