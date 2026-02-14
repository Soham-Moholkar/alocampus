import { ApiError, apiRequest, withQuery } from './api'
import { endpoints } from './endpoints'
import { demoActivitySeed } from './demoData'
import { loadSyntheticActivity } from './storage'
import type { ActivityItem } from '../types/api'

interface ActivityQuery {
  address?: string
  limit?: number
  pollId?: number
  sessionId?: number
  kind?: string
  tag?: string
  offset?: number
  includeSynthetic?: boolean
}

const normalizeFeed = (payload: unknown): ActivityItem[] => {
  if (Array.isArray(payload)) {
    return payload as ActivityItem[]
  }
  if (payload && typeof payload === 'object' && 'items' in payload) {
    const items = (payload as { items: ActivityItem[] }).items
    return Array.isArray(items) ? items : []
  }
  return []
}

export const fetchActivityFeed = async (query: ActivityQuery = {}): Promise<ActivityItem[]> => {
  const synthetic = query.includeSynthetic ? [...demoActivitySeed, ...loadSyntheticActivity()] : []
  const path = withQuery(endpoints.activity, {
    address: query.address,
    limit: query.limit,
    pollId: query.pollId,
    sessionId: query.sessionId,
    kind: query.kind,
    tag: query.tag,
    offset: query.offset,
  })

  try {
    const payload = await apiRequest<unknown>(path)
    const normalized = normalizeFeed(payload)
    const merged = [...normalized, ...synthetic]
    merged.sort((a, b) => b.created - a.created)
    return merged.slice(0, query.limit ?? 50)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status < 500) throw error
    if (synthetic.length === 0) throw error
  }

  const fallbackOnly = [...synthetic]
  fallbackOnly.sort((a, b) => b.created - a.created)
  return fallbackOnly.slice(0, query.limit ?? 50)
}
