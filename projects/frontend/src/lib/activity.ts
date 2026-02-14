import { ApiError, apiRequest, withQuery } from './api'
import { endpoints } from './endpoints'
import type {
  ActivityItem,
  CertListResponse,
  PollListResponse,
  SessionListResponse,
} from '../types/api'

interface ActivityQuery {
  address?: string
  limit?: number
  pollId?: number
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

const fallbackFeed = async (query: ActivityQuery): Promise<ActivityItem[]> => {
  const [pollsRes, sessionsRes, certsRes] = await Promise.allSettled([
    apiRequest<PollListResponse>(endpoints.polls),
    apiRequest<SessionListResponse>(endpoints.sessions),
    apiRequest<CertListResponse>(endpoints.certList),
  ])

  const activities: ActivityItem[] = []

  if (pollsRes.status === 'fulfilled') {
    pollsRes.value.polls.forEach((poll) => {
      activities.push({
        id: `poll-${poll.poll_id}`,
        kind: 'poll_created',
        title: `Poll #${poll.poll_id} created`,
        description: poll.question,
        actor: poll.creator,
        tx_id: poll.tx_id,
        created: poll.created ?? 0,
        tags: [`poll:${poll.poll_id}`],
      })
    })
  }

  if (sessionsRes.status === 'fulfilled') {
    sessionsRes.value.sessions.forEach((session) => {
      activities.push({
        id: `session-${session.session_id}`,
        kind: 'session_created',
        title: `Attendance session #${session.session_id} created`,
        description: session.course_code,
        actor: session.creator,
        tx_id: session.tx_id,
        created: session.created ?? 0,
        tags: [`session:${session.session_id}`],
      })
    })
  }

  if (certsRes.status === 'fulfilled') {
    certsRes.value.certs.forEach((cert) => {
      activities.push({
        id: `cert-${cert.cert_hash}`,
        kind: 'cert_issued',
        title: 'Certificate issued',
        description: cert.cert_hash,
        actor: cert.recipient,
        created: cert.created ?? 0,
        tags: [`cert:${cert.cert_hash}`],
      })
    })
  }

  let filtered = activities
  if (query.address) {
    filtered = filtered.filter((item) => item.actor === query.address)
  }
  if (query.pollId !== undefined) {
    filtered = filtered.filter((item) => item.tags?.includes(`poll:${query.pollId}`))
  }

  filtered.sort((a, b) => b.created - a.created)
  return filtered.slice(0, query.limit ?? 50)
}

export const fetchActivityFeed = async (query: ActivityQuery = {}): Promise<ActivityItem[]> => {
  try {
    const path = withQuery(endpoints.activity, {
      address: query.address,
      limit: query.limit,
      pollId: query.pollId,
    })
    const payload = await apiRequest<unknown>(path)
    const normalized = normalizeFeed(payload)
    if (normalized.length > 0) {
      return normalized
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error
    }
  }

  return fallbackFeed(query)
}
