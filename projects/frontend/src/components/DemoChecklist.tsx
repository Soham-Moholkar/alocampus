interface DemoChecklistItem {
  label: string
  done: boolean
}

interface DemoChecklistProps {
  title: string
  items: DemoChecklistItem[]
}

export const DemoChecklist = ({ title, items }: DemoChecklistProps) => (
  <div className="card demo-checklist">
    <div className="card-header">
      <h3>{title}</h3>
      <span className="badge">Demo Mode</span>
    </div>
    <ul>
      {items.map((item) => (
        <li key={item.label} className={item.done ? 'done' : 'pending'}>
          <span>{item.done ? 'Done' : 'Next'}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  </div>
)
