import { describe,expect,it } from 'vitest'
import { localDateValue,newTripDateError } from './trip-dates'

describe('fechas de un viaje nuevo',()=>{
  it('genera la fecha local sin convertirla a UTC',()=>{
    expect(localDateValue(new Date(2026,8,12,23,30))).toBe('2026-09-12')
  })

  it('rechaza una salida anterior a hoy',()=>{
    expect(newTripDateError('2026-09-11','2026-09-15','2026-09-12')).toBe('La fecha de salida no puede ser anterior a hoy.')
  })

  it('rechaza una vuelta anterior a la salida',()=>{
    expect(newTripDateError('2026-09-15','2026-09-14','2026-09-12')).toBe('La fecha de vuelta no puede ser anterior a la de salida.')
  })

  it('admite salir hoy y volver el mismo día',()=>{
    expect(newTripDateError('2026-09-12','2026-09-12','2026-09-12')).toBeNull()
  })
})
