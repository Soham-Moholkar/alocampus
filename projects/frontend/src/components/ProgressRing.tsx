import type { CSSProperties } from 'react'

interface ProgressRingProps {
  value: number
  label: string
  subtitle?: string
  tone?: 'indigo' | 'teal' | 'amber' | 'violet'
  compact?: boolean
}

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

export const ProgressRing = ({
  value,
  label,
  subtitle,
  tone = 'indigo',
  compact = false,
}: ProgressRingProps) => {
  const normalized = clamp(value)
  const radius = compact ? 27 : 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (normalized / 100) * circumference

  return (
    <div className={`progress-ring-card${compact ? ' compact' : ''}`}>
      <div className="progress-ring-header">
        <strong>{label}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className={`progress-ring progress-${tone}`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} className="ring-track" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="ring-value"
            style={
              {
                strokeDasharray: circumference,
                strokeDashoffset: offset,
              } as CSSProperties
            }
          />
        </svg>
        <span>{normalized}%</span>
      </div>
    </div>
  )
}
