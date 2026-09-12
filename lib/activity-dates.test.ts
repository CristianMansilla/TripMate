import { describe, expect, it } from 'vitest'
import { isMultiDayOccurrence, occurrenceDateError, occurrenceEndDate, occurrencesOverlap } from './activity-dates'

const tripStart='2026-09-10'
const tripEnd='2026-09-20'

describe('activity dates',()=>{
  it('keeps legacy occurrences on their start date',()=>{
    expect(occurrenceEndDate({date:'2026-09-12'})).toBe('2026-09-12')
    expect(isMultiDayOccurrence({date:'2026-09-12'})).toBe(false)
  })

  it('accepts an overnight time when the occurrence ends the next day',()=>{
    const occurrence={date:'2026-09-12',endDate:'2026-09-13',startTime:'23:30',endTime:'06:15'}
    expect(occurrenceDateError(occurrence,tripStart,tripEnd)).toBeNull()
    expect(isMultiDayOccurrence(occurrence)).toBe(true)
  })

  it('rejects a backwards time on the same day',()=>{
    expect(occurrenceDateError({date:'2026-09-12',startTime:'23:30',endTime:'06:15'},tripStart,tripEnd))
      .toBe('La hora de fin debe ser posterior a la hora de inicio.')
  })

  it('rejects reversed and out-of-trip date ranges',()=>{
    expect(occurrenceDateError({date:'2026-09-12',endDate:'2026-09-11'},tripStart,tripEnd))
      .toBe('La fecha de finalización no puede ser anterior al inicio.')
    expect(occurrenceDateError({date:'2026-09-12',endDate:'2026-09-21'},tripStart,tripEnd))
      .toBe('Los días deben estar dentro de las fechas del viaje.')
  })

  it('detects overlap across midnight',()=>{
    const overnight={date:'2026-09-12',endDate:'2026-09-13',startTime:'23:30',endTime:'06:15'}
    expect(occurrencesOverlap(overnight,{date:'2026-09-13',startTime:'05:30',endTime:'07:00'})).toBe(true)
    expect(occurrencesOverlap(overnight,{date:'2026-09-13',startTime:'08:00',endTime:'09:00'})).toBe(false)
  })
})
