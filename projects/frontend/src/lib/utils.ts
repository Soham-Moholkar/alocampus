export const shortenAddress = (address?: string | null, size = 6): string => {
  if (!address) {
    return '--'
  }
  if (address.length <= size * 2) {
    return address
  }
  return `${address.slice(0, size)}...${address.slice(-size)}`
}

export const formatDateTime = (ts?: number): string => {
  if (!ts) {
    return '--'
  }
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000
  return new Date(ms).toLocaleString()
}

export const formatRelative = (ts?: number): string => {
  if (!ts) {
    return '--'
  }
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000
  const diff = Date.now() - ms
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ${diff >= 0 ? 'ago' : 'from now'}`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ${diff >= 0 ? 'ago' : 'from now'}`
  }
  const days = Math.round(hours / 24)
  return `${days}d ${diff >= 0 ? 'ago' : 'from now'}`
}

export const copyText = async (value: string): Promise<void> => {
  await navigator.clipboard.writeText(value)
}

export const toBase64 = (bytes: Uint8Array): string => {
  let output = ''
  bytes.forEach((b) => {
    output += String.fromCharCode(b)
  })
  return btoa(output)
}

export const fromStringToBytes = (value: string): Uint8Array => new TextEncoder().encode(value)

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
