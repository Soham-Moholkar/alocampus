import { useEffect, useState } from 'react'

import { Card } from '../../components/Card'
import { getConfig } from '../../lib/config'
import { endpointMismatches } from '../../lib/endpoints'

const THEME_KEY = 'algocampus.theme'

export const SettingsPage = () => {
  const config = getConfig()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <div className="page-grid">
      <Card title="Display Settings">
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
        </div>
      </Card>

      <Card title="Network Mode">
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

      <Card title="Endpoint Mapping Notes">
        <ul>
          {endpointMismatches.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
