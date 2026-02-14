import type { Role } from '../types/api'

const KEY_JWT = 'algocampus.jwt'
const KEY_ROLE = 'algocampus.role'
const KEY_ADDRESS = 'algocampus.address'
const KEY_DEMO_MODE = 'algocampus.demoMode'
const KEY_VOTES = 'algocampus.localVotes'
const KEY_CHECKINS = 'algocampus.localCheckins'

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
