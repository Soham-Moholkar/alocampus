interface StatusPillProps {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}

export const StatusPill = ({ label, tone = 'neutral' }: StatusPillProps) => (
  <span className={`badge badge-${tone}`}>{label}</span>
)
