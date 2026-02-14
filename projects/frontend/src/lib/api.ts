import { getConfig } from './config'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown | FormData
  auth?: boolean
  headers?: Record<string, string>
}

type AuthProvider = () => string | null
type UnauthorizedHandler = () => void

let getToken: AuthProvider = () => null
let onUnauthorized: UnauthorizedHandler = () => undefined

export const configureApiAuth = (
  tokenProvider: AuthProvider,
  unauthorizedHandler: UnauthorizedHandler,
): void => {
  getToken = tokenProvider
  onUnauthorized = unauthorizedHandler
}

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload: unknown = null) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

const buildUrl = (path: string): string => {
  const base = getConfig().bffBaseUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const parseResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const isFormDataBody = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }

  if (options.auth !== false) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? (isFormDataBody ? options.body : JSON.stringify(options.body)) : undefined,
  })

  const payload = await parseResponse(response)

  if (response.status === 401) {
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload && typeof payload.detail === 'string'
        ? payload.detail
        : 'Unauthorized'

    if (options.auth !== false) {
      onUnauthorized()
      throw new ApiError(401, 'Session expired. Please sign in again.', payload)
    }

    throw new ApiError(401, detail, payload)
  }

  if (!response.ok) {
    const fallback = typeof payload === 'string' ? payload : response.statusText
    throw new ApiError(response.status, fallback || 'Request failed', payload)
  }

  return payload as T
}

export const withQuery = (
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): string => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  })
  const qs = params.toString()
  return qs.length ? `${path}?${qs}` : path
}
