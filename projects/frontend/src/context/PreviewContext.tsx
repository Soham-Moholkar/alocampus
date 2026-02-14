import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import type { Role } from '../types/api'
import { clearPreviewSession, loadPreviewSession, savePreviewSession } from '../lib/storage'

interface PreviewContextValue {
  enabled: boolean
  role: Role | null
  enterPreview: (role: Role) => void
  exitPreview: () => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

export const PreviewProvider = ({ children }: { children: ReactNode }) => {
  const seed = loadPreviewSession()
  const [enabled, setEnabled] = useState(seed.enabled)
  const [role, setRole] = useState<Role | null>(seed.role)

  const enterPreview = (nextRole: Role): void => {
    setEnabled(true)
    setRole(nextRole)
    savePreviewSession(nextRole)
  }

  const exitPreview = (): void => {
    setEnabled(false)
    setRole(null)
    clearPreviewSession()
  }

  const value = useMemo(
    () => ({
      enabled,
      role,
      enterPreview,
      exitPreview,
    }),
    [enabled, role],
  )

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
}

export const usePreview = (): PreviewContextValue => {
  const ctx = useContext(PreviewContext)
  if (!ctx) {
    throw new Error('usePreview must be used within PreviewProvider')
  }
  return ctx
}
