import { requiredConfigKeys } from '../../lib/config'

export const ConfigMissingPage = ({ missing }: { missing: string[] }) => (
  <div className="config-missing">
    <h1>Config Missing</h1>
    <p>The frontend cannot start because required LocalNet variables are missing.</p>

    <section className="card">
      <h3>Missing Keys</h3>
      <ul>
        {missing.map((key) => (
          <li key={key}>
            <code>{key}</code>
          </li>
        ))}
      </ul>
    </section>

    <section className="card">
      <h3>Required Keys</h3>
      <ul>
        {requiredConfigKeys.map((key) => (
          <li key={key}>
            <code>{key}</code>
          </li>
        ))}
      </ul>
      <p>Use <code>projects/frontend/.env.localnet</code> as the template and run <code>npm run dev:localnet</code>.</p>
    </section>
  </div>
)
