interface MetricTileProps {
  title: string
  value: string | number
  caption?: string
  tone?: 'indigo' | 'teal' | 'amber' | 'violet'
}

export const MetricTile = ({ title, value, caption, tone = 'indigo' }: MetricTileProps) => (
  <article className={`metric-tile metric-${tone}`}>
    <span className="metric-label">{title}</span>
    <strong className="metric-value">{value}</strong>
    {caption ? <p>{caption}</p> : null}
  </article>
)
