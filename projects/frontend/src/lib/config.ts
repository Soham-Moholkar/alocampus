const requiredKeys = [
  'VITE_ALGOD_SERVER',
  'VITE_ALGOD_PORT',
  'VITE_ALGOD_TOKEN',
  'VITE_INDEXER_SERVER',
  'VITE_INDEXER_PORT',
  'VITE_INDEXER_TOKEN',
  'VITE_KMD_SERVER',
  'VITE_KMD_PORT',
  'VITE_KMD_TOKEN',
  'VITE_ALGOD_NETWORK',
  'VITE_BFF_BASE_URL',
] as const

const allowEmptyValue = new Set<string>(['VITE_INDEXER_TOKEN'])

export interface AppConfig {
  algodServer: string
  algodPort: string
  algodToken: string
  indexerServer: string
  indexerPort: string
  indexerToken: string
  kmdServer: string
  kmdPort: string
  kmdToken: string
  algodNetwork: string
  bffBaseUrl: string
}

export interface ConfigValidation {
  ok: boolean
  missing: string[]
}

export const validateConfig = (): ConfigValidation => {
  const missing = requiredKeys.filter((key) => {
    const raw = import.meta.env[key]
    if (raw === undefined) {
      return true
    }
    if (allowEmptyValue.has(key)) {
      return false
    }
    return String(raw).trim().length === 0
  })
  return { ok: missing.length === 0, missing: [...missing] }
}

export const getConfig = (): AppConfig => {
  const env = import.meta.env
  return {
    algodServer: env.VITE_ALGOD_SERVER,
    algodPort: env.VITE_ALGOD_PORT,
    algodToken: env.VITE_ALGOD_TOKEN,
    indexerServer: env.VITE_INDEXER_SERVER,
    indexerPort: env.VITE_INDEXER_PORT,
    indexerToken: env.VITE_INDEXER_TOKEN,
    kmdServer: env.VITE_KMD_SERVER,
    kmdPort: env.VITE_KMD_PORT,
    kmdToken: env.VITE_KMD_TOKEN,
    algodNetwork: env.VITE_ALGOD_NETWORK,
    bffBaseUrl: env.VITE_BFF_BASE_URL,
  }
}

export const requiredConfigKeys = [...requiredKeys]
