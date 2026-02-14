import type { ActivityItem, Role } from '../types/api'

const KEY_JWT = 'algocampus.jwt'
const KEY_ROLE = 'algocampus.role'
const KEY_ADDRESS = 'algocampus.address'
const KEY_DEMO_MODE = 'algocampus.demoMode'
const KEY_VOTES = 'algocampus.localVotes'
const KEY_CHECKINS = 'algocampus.localCheckins'
const KEY_PREVIEW_ROLE = 'algocampus.preview.role'
const KEY_PREVIEW_ENABLED = 'algocampus.preview.enabled'
const KEY_DEMO_POLL_RESULTS = 'algocampus.demo.pollResults'
const KEY_SYNTH_ACTIVITY = 'algocampus.synthetic.activity'
const KEY_ROLE_ENTRY_PROFILE = 'algocampus.roleEntryProfile'
const KEY_TOUR_COMPLETED_PREFIX = 'algocampus.tour.completed'

interface DemoPollResultStore {
  [pollId: string]: number[]
}

export interface RoleEntryProfile {
  role: Role
  displayName: string
  identifier: string
  updatedAt: number
}

export const sessionStorageKeys = {
  KEY_JWT,
  KEY_ROLE,
  KEY_ADDRESS,
}

export const loadSession = (): { jwt: string | null; role: Role | null; address: string | null } => {
  const role = localStorage.getItem(KEY_ROLE) as Role | null
  return {
    jwt: localStorage.getItem(KEY_JWT),
    role,
    address: localStorage.getItem(KEY_ADDRESS),
  }
}

export const saveSession = (jwt: string, role: Role, address: string): void => {
  localStorage.setItem(KEY_JWT, jwt)
  localStorage.setItem(KEY_ROLE, role)
  localStorage.setItem(KEY_ADDRESS, address)
}

export const clearSession = (): void => {
  localStorage.removeItem(KEY_JWT)
  localStorage.removeItem(KEY_ROLE)
  localStorage.removeItem(KEY_ADDRESS)
}

export const getDemoMode = (): boolean => localStorage.getItem(KEY_DEMO_MODE) === '1'

export const setDemoMode = (value: boolean): void => {
  localStorage.setItem(KEY_DEMO_MODE, value ? '1' : '0')
}

export const getLocalVotes = (): number[] => {
  try {
    const raw = localStorage.getItem(KEY_VOTES)
    if (!raw) {
      return []
    }
    return JSON.parse(raw) as number[]
  } catch {
    return []
  }
}

export const markLocalVote = (pollId: number): void => {
  const set = new Set(getLocalVotes())
  set.add(pollId)
  localStorage.setItem(KEY_VOTES, JSON.stringify([...set]))
}

export const getLocalCheckins = (): number[] => {
  try {
    const raw = localStorage.getItem(KEY_CHECKINS)
    if (!raw) {
      return []
    }
    return JSON.parse(raw) as number[]
  } catch {
    return []
  }
}

export const markLocalCheckin = (sessionId: number): void => {
  const set = new Set(getLocalCheckins())
  set.add(sessionId)
  localStorage.setItem(KEY_CHECKINS, JSON.stringify([...set]))
}

export const loadPreviewSession = (): { enabled: boolean; role: Role | null } => ({
  enabled: localStorage.getItem(KEY_PREVIEW_ENABLED) === '1',
  role: (localStorage.getItem(KEY_PREVIEW_ROLE) as Role | null) ?? null,
})

export const savePreviewSession = (role: Role): void => {
  localStorage.setItem(KEY_PREVIEW_ENABLED, '1')
  localStorage.setItem(KEY_PREVIEW_ROLE, role)
}

export const clearPreviewSession = (): void => {
  localStorage.removeItem(KEY_PREVIEW_ENABLED)
  localStorage.removeItem(KEY_PREVIEW_ROLE)
}

export const loadRoleEntryProfile = (): RoleEntryProfile | null => {
  try {
    const raw = localStorage.getItem(KEY_ROLE_ENTRY_PROFILE)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as RoleEntryProfile
    if (
      !parsed ||
      (parsed.role !== 'student' && parsed.role !== 'faculty' && parsed.role !== 'admin') ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.identifier !== 'string' ||
      typeof parsed.updatedAt !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const saveRoleEntryProfile = (profile: RoleEntryProfile): void => {
  localStorage.setItem(KEY_ROLE_ENTRY_PROFILE, JSON.stringify(profile))
}

export const clearRoleEntryProfile = (): void => {
  localStorage.removeItem(KEY_ROLE_ENTRY_PROFILE)
}

const tourKey = (role: Role): string => `${KEY_TOUR_COMPLETED_PREFIX}.${role}`

export const isTourCompleted = (role: Role): boolean => localStorage.getItem(tourKey(role)) === '1'

export const setTourCompleted = (role: Role, completed = true): void => {
  localStorage.setItem(tourKey(role), completed ? '1' : '0')
}

export const resetTourCompletion = (role?: Role): void => {
  if (role) {
    localStorage.removeItem(tourKey(role))
    return
  }
  ;(['student', 'faculty', 'admin'] as Role[]).forEach((entry) => localStorage.removeItem(tourKey(entry)))
}

const loadDemoPollResultStore = (): DemoPollResultStore => {
  try {
    const raw = localStorage.getItem(KEY_DEMO_POLL_RESULTS)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as DemoPollResultStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const saveDemoPollResultStore = (store: DemoPollResultStore): void => {
  localStorage.setItem(KEY_DEMO_POLL_RESULTS, JSON.stringify(store))
}

export const getDemoPollResults = (pollId: number, optionCount: number): number[] => {
  const store = loadDemoPollResultStore()
  const existing = store[String(pollId)]
  if (Array.isArray(existing) && existing.length === optionCount) {
    return existing
  }
  return Array.from({ length: optionCount }, () => 0)
}

export const castDemoPollVote = (pollId: number, optionIndex: number, optionCount: number): number[] => {
  const store = loadDemoPollResultStore()
  const key = String(pollId)
  const next = Array.from({ length: optionCount }, (_, idx) => {
    const existing = Array.isArray(store[key]) ? store[key][idx] ?? 0 : 0
    return idx === optionIndex ? existing + 1 : existing
  })
  store[key] = next
  saveDemoPollResultStore(store)
  return next
}

export const loadSyntheticActivity = (): ActivityItem[] => {
  try {
    const raw = localStorage.getItem(KEY_SYNTH_ACTIVITY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as ActivityItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const appendSyntheticActivity = (
  payload: Omit<ActivityItem, 'id' | 'created'> & Partial<Pick<ActivityItem, 'id' | 'created'>>,
): ActivityItem => {
  const existing = loadSyntheticActivity()
  const entry: ActivityItem = {
    ...payload,
    id: payload.id ?? `synthetic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    created: payload.created ?? Date.now(),
  }
  const next = [entry, ...existing].slice(0, 120)
  localStorage.setItem(KEY_SYNTH_ACTIVITY, JSON.stringify(next))
  return entry
}
