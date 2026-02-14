import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { getDemoMode, setDemoMode } from '../lib/storage'

interface DemoModeContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  toggle: () => void
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

export const DemoModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabledState] = useState<boolean>(getDemoMode())

  const setEnabled = (next: boolean): void => {
    setEnabledState(next)
    setDemoMode(next)
  }

  const toggle = (): void => {
    setEnabled(!enabled)
  }

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      toggle,
    }),
    [enabled],
  )

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
}

export const useDemoMode = (): DemoModeContextValue => {
  const ctx = useContext(DemoModeContext)
  if (!ctx) {
    throw new Error('useDemoMode must be used within DemoModeProvider')
  }
  return ctx
}
