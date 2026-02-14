import type { ReactNode } from 'react'

interface InfoItem {
  id: string
  title: string
  detail: string
  stamp?: string
  avatar?: string
}

interface InfoPanelProps {
  title: string
  items: InfoItem[]
  footer?: ReactNode
}

export const InfoPanel = ({ title, items, footer }: InfoPanelProps) => (
  <section className="info-panel">
    <div className="info-panel-head">
      <h4>{title}</h4>
    </div>
    <div className="info-panel-body">
      {items.map((item) => (
        <article key={item.id} className="info-item">
          {item.avatar ? <img src={item.avatar} alt="" /> : <span className="dot" />}
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            {item.stamp ? <small>{item.stamp}</small> : null}
          </div>
        </article>
      ))}
    </div>
    {footer ? <div className="info-panel-footer">{footer}</div> : null}
  </section>
)
