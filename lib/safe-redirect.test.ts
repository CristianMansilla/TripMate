import { describe, expect, it } from 'vitest'
import { safeInternalPath } from './safe-redirect'

describe('safe internal redirects', () => {
  it('preserves an internal path with query and fragment', () => {
    expect(safeInternalPath('/trip/123?seccion=reservas#detalle')).toBe('/trip/123?seccion=reservas#detalle')
  })

  it('rejects absolute and protocol-relative destinations', () => {
    expect(safeInternalPath('https://example.com')).toBe('/dashboard')
    expect(safeInternalPath('//example.com')).toBe('/dashboard')
  })

  it('rejects backslashes and uses a caller-provided fallback', () => {
    expect(safeInternalPath('/\\example.com', '/login')).toBe('/login')
    expect(safeInternalPath(null, '/login')).toBe('/login')
  })
})
