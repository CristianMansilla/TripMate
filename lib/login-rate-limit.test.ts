import { describe, expect, it } from 'vitest'
import { LoginRateLimiter, loginClientAddress } from './login-rate-limit'

describe('login rate limit', () => {
  it('blocks a repeated address and identifier pair', () => {
    const limiter = new LoginRateLimiter({ pairLimit: 3, ipLimit: 10, windowMs: 1_000, blockMs: 2_000 })
    expect(limiter.recordFailure('203.0.113.1', 'viajero')).toMatchObject({ limited: false })
    expect(limiter.recordFailure('203.0.113.1', 'viajero')).toMatchObject({ limited: false })
    expect(limiter.recordFailure('203.0.113.1', 'viajero')).toMatchObject({ limited: true, retryAfterSeconds: 2 })
  })

  it('keeps another identifier available and applies an address-wide ceiling', () => {
    const limiter = new LoginRateLimiter({ pairLimit: 3, ipLimit: 4, windowMs: 1_000, blockMs: 2_000 })
    limiter.recordFailure('203.0.113.2', 'uno', 0)
    limiter.recordFailure('203.0.113.2', 'uno', 0)
    expect(limiter.check('203.0.113.2', 'dos', 0).limited).toBe(false)
    limiter.recordFailure('203.0.113.2', 'dos', 0)
    expect(limiter.recordFailure('203.0.113.2', 'dos', 0).limited).toBe(true)
  })

  it('clears the successful pair and releases expired blocks', () => {
    const limiter = new LoginRateLimiter({ pairLimit: 2, ipLimit: 10, windowMs: 1_000, blockMs: 2_000 })
    limiter.recordFailure('203.0.113.3', 'viajero', 0)
    limiter.recordFailure('203.0.113.3', 'viajero', 0)
    limiter.clearSuccessfulPair('203.0.113.3', 'viajero')
    expect(limiter.check('203.0.113.3', 'viajero', 100).limited).toBe(false)

    limiter.recordFailure('203.0.113.4', 'viajero', 0)
    limiter.recordFailure('203.0.113.4', 'viajero', 0)
    expect(limiter.check('203.0.113.4', 'viajero', 2_001).limited).toBe(false)
  })

  it('uses the first forwarded address and never returns an unbounded value', () => {
    expect(loginClientAddress(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
    expect(loginClientAddress(new Headers())).toBe('unknown')
  })
})
