import { useEffect, useState } from 'react'

import { Card } from '../../components/Card'
import { getConfig } from '../../lib/config'
import { integrationHighlights } from '../../lib/endpoints'

const THEME_KEY = 'algocampus.theme'
const RIGHT_RAIL_KEY = 'algocampus.ui.rightRail'

export const SettingsPage = () => {
  const config = getConfig()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const [railOpen, setRailOpen] = useState(() => localStorage.getItem(RIGHT_RAIL_KEY) !== '0')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(RIGHT_RAIL_KEY, railOpen ? '1' : '0')
  }, [railOpen])

  return (
    <div className="page-grid">
      <Card title="Display Settings" subtitle="Personal UI preferences">
        <div className="inline-row">
          <button
            type="button"
            className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
          <button
            type="button"
            className={`btn ${railOpen ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRailOpen((prev) => !prev)}
          >
            Right Rail: {railOpen ? 'On' : 'Off'}
          </button>
        </div>
      </Card>

      <Card title="Network Mode" subtitle="LocalNet runtime details">
        <div className="kv">
          <span>Network</span>
          <span>{config.algodNetwork}</span>
        </div>
        <div className="kv">
          <span>BFF Base URL</span>
          <code>{config.bffBaseUrl}</code>
        </div>
        <div className="kv">
          <span>Algod</span>
          <code>{`${config.algodServer}:${config.algodPort}`}</code>
        </div>
        <div className="kv">
          <span>Indexer</span>
          <code>{`${config.indexerServer}:${config.indexerPort}`}</code>
        </div>
        <div className="kv">
          <span>KMD</span>
          <code>{`${config.kmdServer}:${config.kmdPort}`}</code>
        </div>
      </Card>

      <Card title="Integration Notes" subtitle="Current platform wiring for LocalNet mode">
        <ul>
          {integrationHighlights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
