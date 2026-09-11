import { describe, expect, it } from 'vitest'
import { tripSectionPath, tripTabFromParam, tripTabSlug } from './trip-navigation'

describe('trip navigation',()=>{
  it('maps valid URL sections to interface tabs',()=>{
    expect(tripTabFromParam('itinerario')).toBe('Itinerario')
    expect(tripTabFromParam('RESERVAS')).toBe('Reservas')
    expect(tripTabFromParam(['lugares','resumen'])).toBe('Lugares')
  })

  it('falls back to the summary for missing or invalid sections',()=>{
    expect(tripTabFromParam(undefined)).toBe('Resumen')
    expect(tripTabFromParam('desconocida')).toBe('Resumen')
  })

  it('builds a shareable path while preserving other query parameters',()=>{
    expect(tripTabSlug('Presupuesto')).toBe('presupuesto')
    expect(tripSectionPath('trip 1','Reservas','filtro=pendientes')).toBe('/trip/trip%201?filtro=pendientes&seccion=reservas')
  })
})
