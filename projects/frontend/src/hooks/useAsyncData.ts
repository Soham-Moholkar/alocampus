import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const useAsyncData = <T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  initialLoad = true,
): AsyncState<T> => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(initialLoad)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (mounted.current) {
        setData(result)
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Unexpected error')
      }
    } finally {
      if (mounted.current) {
        setLoading(false)
      }
    }
  }, deps)

  useEffect(() => {
    if (initialLoad) {
      void refresh()
    }
  }, [refresh, initialLoad])

  return { data, loading, error, refresh }
}
