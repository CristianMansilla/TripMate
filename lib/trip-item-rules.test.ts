import { describe,expect,it } from 'vitest'
import type { Expense } from './types'
import {
  canonicalItemCategory,
  expenseGroupTotal,
  expenseOccurrenceMultiplier,
  isTechnicalLegacyCategory,
  itineraryStatus,
  itineraryStatusLabel,
  savedPlaceValue,
  sortReservationsForDisplay,
} from './trip-item-rules'

function expense(overrides:Partial<Expense>={}):Expense{
  return {
    id:'expense-1',tripId:'trip-1',title:'Museo',category:'Museo',amount:100,
    status:'estimated',scope:'per_person',...overrides,
  }
}

describe('trip item rules',()=>{
  it('normalizes historical category aliases',()=>{
    expect(canonicalItemCategory('food')).toBe('Comida')
    expect(canonicalItemCategory('Comidas')).toBe('Comida')
    expect(canonicalItemCategory('ENTRADAS')).toBe('Evento')
    expect(canonicalItemCategory('Categoría propia')).toBe('Categoría propia')
  })

  it('keeps technical legacy categories out of normal choices',()=>{
    expect(isTechnicalLegacyCategory('other')).toBe(true)
    expect(isTechnicalLegacyCategory('reservation')).toBe(true)
    expect(isTechnicalLegacyCategory('Museo')).toBe(false)
  })

  it('maps legacy reservation and payment activity states to agenda state',()=>{
    expect(itineraryStatus('reserved')).toBe('planned')
    expect(itineraryStatus('paid')).toBe('planned')
    expect(itineraryStatusLabel('done')).toBe('Hecho')
  })

  it('does not multiply a repeated expense whose amount is total',()=>{
    const repeated=expense({occurrencePricing:'total',occurrences:[{date:'2026-01-01'},{date:'2026-01-02'}]})
    expect(expenseOccurrenceMultiplier(repeated)).toBe(1)
    expect(expenseGroupTotal(repeated,3)).toBe(300)
  })

  it('multiplies per-occurrence costs and respects group pricing',()=>{
    const repeated=expense({amountBasis:'group',occurrencePricing:'per_occurrence'})
    expect(expenseOccurrenceMultiplier(repeated,3)).toBe(3)
    expect(expenseGroupTotal(repeated,4,3)).toBe(300)
  })

  it('formats saved places consistently',()=>{
    expect(savedPlaceValue({name:'Museo',address:'Colón 100'})).toBe('Museo, Colón 100')
    expect(savedPlaceValue({name:'Plaza'})).toBe('Plaza')
  })

  it('orders reservations by action, due date and title',()=>{
    const reservations=[
      {id:'4',tripId:'trip-1',title:'Hotel',status:'reserved',priority:'high'},
      {id:'3',tripId:'trip-1',title:'Cena',status:'watching',priority:'low'},
      {id:'2',tripId:'trip-1',title:'Museo',status:'pending',priority:'low',dueDate:'2026-01-08'},
      {id:'1',tripId:'trip-1',title:'Aerosilla',status:'pending',priority:'high',dueDate:'2026-01-03'},
    ] satisfies import('./types').Reservation[]

    expect([...reservations].sort(sortReservationsForDisplay).map(item=>item.id)).toEqual(['1','2','3','4'])
  })
})
