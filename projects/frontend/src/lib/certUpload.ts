const HASH_64 = /\b[a-fA-F0-9]{64}\b/g

export interface CertExtractResult {
  source: 'json' | 'text' | 'qr' | 'link' | 'pdf'
  hash?: string
  candidates: string[]
  message: string
  payload?: string
}

const normalizeHash = (value: string): string | null => {
  const hash = value.trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null
}

const extractFromText = (text: string): string[] => {
  const set = new Set<string>()
  for (const match of text.matchAll(HASH_64)) {
    const candidate = match[0].toLowerCase()
    if (!set.has(candidate)) {
      set.add(candidate)
    }
  }
  return [...set]
}

const extractHashField = (payload: unknown): string | null => {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractHashField(item)
      if (nested) return nested
    }
    return null
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const [key, value] of Object.entries(record)) {
      if ((key === 'cert_hash' || key === 'certificate_hash' || key === 'hash') && typeof value === 'string') {
        const normalized = normalizeHash(value)
        if (normalized) {
          return normalized
        }
      }
      const nested = extractHashField(value)
      if (nested) return nested
    }
  }
  return null
}

const canonicalize = (payload: unknown): unknown => {
  if (Array.isArray(payload)) {
    return payload.map((item) => canonicalize(item))
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const keys = Object.keys(record).sort()
    const next: Record<string, unknown> = {}
    keys.forEach((key) => {
      next[key] = canonicalize(record[key])
    })
    return next
  }
  return payload
}

const sha256Hex = async (data: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const extractHashFromUrl = (value: string): string | null => {
  const direct = normalizeHash(value)
  if (direct) return direct

  try {
    const url = new URL(value)
    const fromQuery = normalizeHash(url.searchParams.get('cert_hash') ?? '')
    if (fromQuery) {
      return fromQuery
    }
    const textCandidates = extractFromText(url.toString())
    return textCandidates[0] ?? null
  } catch {
    const candidates = extractFromText(value)
    return candidates[0] ?? null
  }
}

export const extractFromJsonOrTextFile = async (file: File): Promise<CertExtractResult> => {
  const text = await file.text()
  const lowerName = file.name.toLowerCase()
  const isJson = file.type.includes('json') || lowerName.endsWith('.json')

  if (isJson) {
    try {
      const parsed = JSON.parse(text) as unknown
      const fieldHash = extractHashField(parsed)
      if (fieldHash) {
        return { source: 'json', hash: fieldHash, candidates: [fieldHash], message: 'cert_hash extracted from JSON' }
      }

      const canonical = canonicalize(parsed)
      const packed = new TextEncoder().encode(JSON.stringify(canonical))
      const hashed = await sha256Hex(packed)
      return {
        source: 'json',
        hash: hashed,
        candidates: [],
        message: 'No explicit cert_hash field found; using canonical JSON SHA-256',
      }
    } catch {
      // Fall back to plain text extraction.
    }
  }

  const candidates = extractFromText(text)
  if (candidates.length > 0) {
    return { source: 'text', hash: candidates[0], candidates, message: 'Hash extracted from text content' }
  }

  const hashed = await sha256Hex(new TextEncoder().encode(text))
  return {
    source: 'text',
    hash: hashed,
    candidates: [],
    message: 'No explicit hash found; using uploaded text SHA-256',
  }
}

export const extractFromPdfFile = async (file: File): Promise<CertExtractResult> => {
  const raw = new Uint8Array(await file.arrayBuffer())
  const text = new TextDecoder('latin1').decode(raw)
  const candidates = extractFromText(text)
  if (candidates.length > 0) {
    return { source: 'pdf', hash: candidates[0], candidates, message: 'Hash candidate extracted from PDF text stream' }
  }
  return {
    source: 'pdf',
    candidates: [],
    message: 'No 64-char hash candidate detected in PDF text stream',
  }
}

export const extractFromQrImage = async (file: File): Promise<CertExtractResult> => {
  const globalWithDetector = window as unknown as {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>>
    }
  }
  if (!globalWithDetector.BarcodeDetector) {
    return {
      source: 'qr',
      candidates: [],
      message: 'BarcodeDetector not available in this browser; paste QR link manually',
    }
  }

  const image = await createImageBitmap(file)
  try {
    const detector = new globalWithDetector.BarcodeDetector({ formats: ['qr_code'] })
    const matches = await detector.detect(image)
    const payload = matches[0]?.rawValue ?? ''
    if (!payload) {
      return { source: 'qr', candidates: [], message: 'QR detected but payload is empty' }
    }
    const hash = extractHashFromUrl(payload)
    return {
      source: 'qr',
      hash: hash ?? undefined,
      candidates: hash ? [hash] : extractFromText(payload),
      payload,
      message: hash ? 'Hash extracted from QR payload' : 'QR payload found but no hash detected',
    }
  } finally {
    image.close()
  }
}

