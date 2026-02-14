import { useEffect, useState } from 'react'

import { getWalletManager } from '../lib/wallet'

export const useCurrentRound = (): { currentRound: number | null; loading: boolean; error: string | null } => {
  const [currentRound, setCurrentRound] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const manager = getWalletManager()
        const status = await manager.algodClient.status().do()
        if (active) {
          const round = (status as { ['last-round']?: number })['last-round']
          setCurrentRound(round ?? null)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load current round')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()
    const interval = setInterval(() => {
      void load()
    }, 10000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return { currentRound, loading, error }
}
