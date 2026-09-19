import { describe,expect,it } from 'vitest'
import { tripDateRangeLabel } from './date-labels'

describe('trip date range label',()=>{
  it('does not repeat the year when both dates share it',()=>{
    expect(tripDateRangeLabel('2026-01-09','2026-01-10')).toBe('9 de enero a 10 de enero de 2026')
  })

  it('includes both years when the trip crosses a year boundary',()=>{
    expect(tripDateRangeLabel('2026-12-30','2027-01-02')).toBe('30 de diciembre de 2026 a 2 de enero de 2027')
  })

  it('shows a single date only once',()=>{
    expect(tripDateRangeLabel('2026-01-09','2026-01-09')).toBe('9 de enero de 2026')
  })
})
