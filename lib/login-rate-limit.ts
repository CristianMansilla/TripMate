import { createHash } from 'node:crypto'

type RateLimitEntry = {
  failures: number
  windowStartedAt: number
  blockedUntil: number
}

type RateLimitOptions = {
  pairLimit?: number
  ipLimit?: number
  windowMs?: number
  blockMs?: number
  maxEntries?: number
}

export type LoginRateLimitStatus = {
  limited: boolean
  retryAfterSeconds: number
}

const DEFAULT_WINDOW_MS = 15 * 60_000
const DEFAULT_BLOCK_MS = 15 * 60_000

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function loginClientAddress(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
  return address.slice(0, 128)
}

export class LoginRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()
  private readonly pairLimit: number
  private readonly ipLimit: number
  private readonly windowMs: number
  private readonly blockMs: number
  private readonly maxEntries: number

  constructor(options: RateLimitOptions = {}) {
    this.pairLimit = options.pairLimit ?? 5
    this.ipLimit = options.ipLimit ?? 20
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
    this.blockMs = options.blockMs ?? DEFAULT_BLOCK_MS
    this.maxEntries = options.maxEntries ?? 2_000
  }

  check(address: string, identifier = '', now = Date.now()): LoginRateLimitStatus {
    this.removeExpired(now)
    const retryAfterMs = this.keys(address, identifier).reduce((longest, key) => {
      const entry = this.entries.get(key)
      return Math.max(longest, entry && entry.blockedUntil > now ? entry.blockedUntil - now : 0)
    }, 0)
    return {
      limited: retryAfterMs > 0,
      retryAfterSeconds: Math.max(0, Math.ceil(retryAfterMs / 1_000)),
    }
  }

  recordFailure(address: string, identifier = '', now = Date.now()): LoginRateLimitStatus {
    for (const [key, limit] of this.keysWithLimits(address, identifier)) {
      const current = this.entries.get(key)
      const expired = !current || current.windowStartedAt + this.windowMs <= now
      const next: RateLimitEntry = expired
        ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
        : { ...current, failures: current.failures + 1 }
      if (next.failures >= limit) next.blockedUntil = now + this.blockMs
      this.setEntry(key, next)
    }
    return this.check(address, identifier, now)
  }

  clearSuccessfulPair(address: string, identifier: string) {
    if (identifier) this.entries.delete(this.pairKey(address, identifier))
  }

  private keys(address: string, identifier: string) {
    return this.keysWithLimits(address, identifier).map(([key]) => key)
  }

  private keysWithLimits(address: string, identifier: string): Array<[string, number]> {
    const keys: Array<[string, number]> = [[`ip:${digest(address)}`, this.ipLimit]]
    if (identifier) keys.push([this.pairKey(address, identifier), this.pairLimit])
    return keys
  }

  private pairKey(address: string, identifier: string) {
    return `pair:${digest(`${address}\0${identifier}`)}`
  }

  private setEntry(key: string, entry: RateLimitEntry) {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey) this.entries.delete(oldestKey)
    }
    this.entries.set(key, entry)
  }

  private removeExpired(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.windowStartedAt + this.windowMs <= now && entry.blockedUntil <= now) {
        this.entries.delete(key)
      }
    }
  }
}

const globalRateLimit = globalThis as typeof globalThis & {
  tripMateLoginRateLimiter?: LoginRateLimiter
}

export const loginRateLimiter = globalRateLimit.tripMateLoginRateLimiter ?? new LoginRateLimiter()
globalRateLimit.tripMateLoginRateLimiter = loginRateLimiter
