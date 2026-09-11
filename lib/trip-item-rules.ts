import type { ActivityStatus, Expense, Reservation } from './types'

const categoryAliases:Record<string,string>={
  activity:'Actividad',actividad:'Actividad',actividades:'Actividad',
  museum:'Museo',museo:'Museo',museos:'Museo',
  event:'Evento',evento:'Evento',eventos:'Evento',entrada:'Evento',entradas:'Evento',
  transport:'Transporte',transporte:'Transporte',
  food:'Comida',comida:'Comida',comidas:'Comida',
  lodging:'Alojamiento',alojamiento:'Alojamiento',
  nightlife:'Noche',noche:'Noche',salida:'Noche',salidas:'Noche',
  paseo:'Paseo',paseos:'Paseo',
  compra:'Compras',compras:'Compras',
  contingencia:'Contingencia',
  other:'Actividad',otro:'Actividad',otros:'Actividad',
  reservation:'Reserva',reserva:'Reserva',reservas:'Reserva',
}

function normalizedKey(value:string){
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
}

export function canonicalItemCategory(category:string){
  const value=category.trim()
  return categoryAliases[normalizedKey(value)] ?? value
}

export function isTechnicalLegacyCategory(category:string){
  return ['other','otro','otros','reservation','reserva','reservas'].includes(normalizedKey(category))
}

export function itineraryStatus(status:ActivityStatus):'idea'|'planned'|'done'{
  if(status==='idea'||status==='done')return status
  return 'planned'
}

export function itineraryStatusLabel(status:ActivityStatus){
  return ({idea:'Idea',planned:'Planificado',done:'Hecho'})[itineraryStatus(status)]
}

export function expenseOccurrenceMultiplier(expense:Expense,linkedActivityCount=0){
  if(expense.occurrencePricing!=='per_occurrence')return 1
  return Math.max(1,expense.occurrences?.length || linkedActivityCount)
}

export function expenseGroupTotal(expense:Expense,travelerCount:number,linkedActivityCount=0){
  const travelers=Math.max(1,travelerCount)
  const base=expense.amountBasis==='group'?expense.amount:expense.amount*travelers
  return base*expenseOccurrenceMultiplier(expense,linkedActivityCount)
}

export function savedPlaceValue(place:{name:string;address?:string}){
  return [place.name,place.address].filter(Boolean).join(', ')
}

const reservationStatusOrder:Record<Reservation['status'],number>={
  pending:0,watching:1,reserved:2,paid:3,
}

export function sortReservationsForDisplay(a:Reservation,b:Reservation){
  const byStatus=reservationStatusOrder[a.status]-reservationStatusOrder[b.status]
  if(byStatus!==0)return byStatus
  const byDueDate=(a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
  if(byDueDate!==0)return byDueDate
  return a.title.localeCompare(b.title,'es',{sensitivity:'base'}) || a.id.localeCompare(b.id)
}
