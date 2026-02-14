interface WidgetListItem {
  id: string
  title: string
  description: string
  avatar?: string
  meta?: string
}

interface WidgetListProps {
  title: string
  items: WidgetListItem[]
}

export const WidgetList = ({ title, items }: WidgetListProps) => (
  <section className="widget-list card">
    <div className="card-header">
      <h3>{title}</h3>
    </div>
    <div className="widget-list-body">
      {items.map((item) => (
        <article key={item.id} className="widget-row">
          {item.avatar ? <img src={item.avatar} alt="" /> : <span className="dot" />}
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            {item.meta ? <small>{item.meta}</small> : null}
          </div>
        </article>
      ))}
    </div>
  </section>
)
