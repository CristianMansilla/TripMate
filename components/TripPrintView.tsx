import { occurrenceEndDate } from '@/lib/activity-dates'
import { money } from '@/lib/money'
import { canonicalItemCategory, expenseGroupTotal, sortReservationsForDisplay } from '@/lib/trip-item-rules'
import type { Activity, Expense, Place, Reservation, Trip } from '@/lib/types'

type Props = {
  trip: Trip
  activities: Activity[]
  expenses: Expense[]
  reservations: Reservation[]
  places: Place[]
}

const activityStatuses:Record<Activity['status'],string>={
  idea:'Idea',planned:'Planificado',reserved:'Reservado',paid:'Pagado',done:'Realizado',
}
const expenseStatuses:Record<Expense['status'],string>={
  estimated:'Estimado',confirmed:'Confirmado',paid:'Pagado',
}
const reservationStatuses:Record<Reservation['status'],string>={
  pending:'Pendiente',watching:'En seguimiento',reserved:'Reservada',paid:'Pagada',
}

function dateLabel(value:string,weekday=false){
  return new Intl.DateTimeFormat('es-AR',{
    day:'numeric',month:'long',year:'numeric',weekday:weekday?'long':undefined,timeZone:'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function activityTime(activity:Activity){
  if(!activity.startTime)return 'Sin hora'
  return activity.endTime?`${activity.startTime} a ${activity.endTime}`:activity.startTime
}

export default function TripPrintView({trip,activities,expenses,reservations,places}:Props){
  const travelers=Math.max(1,trip.travelerCount || 1)
  const sortedActivities=[...activities].sort((a,b)=>
    a.date.localeCompare(b.date) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') ||
    (a.position ?? 0)-(b.position ?? 0) || a.title.localeCompare(b.title,'es')
  )
  const dates=[...new Set(sortedActivities.map(activity=>activity.date))]
  const expenseTotal=(expense:Expense)=>{
    const linkedCount=activities.filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId).length
    return expenseGroupTotal(expense,travelers,linkedCount)
  }
  const groupBudget=expenses.filter(expense=>expense.included!==false).reduce((sum,expense)=>sum+expenseTotal(expense),0)
  const visiblePlaces=places.filter(place=>place.status!=='discarded')
  const sortedReservations=[...reservations].sort(sortReservationsForDisplay)

  return <article className="trip-print-view" aria-label="Plan de viaje para imprimir">
    <header className="print-header">
      <div className="print-brand">TripMate · Plan de viaje</div>
      <h1>{trip.name}</h1>
      <p>{trip.destination}{trip.country?` · ${trip.country}`:''}</p>
      <div className="print-summary">
        <div><span>Fechas</span><strong>{dateLabel(trip.startDate)} al {dateLabel(trip.endDate)}</strong></div>
        <div><span>Viajeros</span><strong>{travelers}</strong></div>
        <div><span>Total grupo</span><strong>{money(groupBudget,trip.currency)}</strong></div>
        <div><span>Por persona</span><strong>{money(groupBudget/travelers,trip.currency)}</strong></div>
      </div>
    </header>

    <section className="print-section">
      <h2>Itinerario</h2>
      {dates.map(date=><div className="print-day" key={date}>
        <h3>{dateLabel(date,true)}</h3>
        {sortedActivities.filter(activity=>activity.date===date).map(activity=><div className="print-activity" key={activity.id}>
          <div className="print-time">{activityTime(activity)}</div>
          <div>
            <strong>{activity.title}{activity.optional?' · Opcional':''}</strong>
            <p>{[
              occurrenceEndDate(activity)!==activity.date?`Finaliza ${dateLabel(occurrenceEndDate(activity))}`:'',
              activity.place,activity.notes,activityStatuses[activity.status],canonicalItemCategory(activity.category),
            ].filter(Boolean).join(' · ')}</p>
            {Boolean(activity.steps?.length)&&<ol className="print-steps">
              {activity.steps!.map((step,index)=><li key={step.id || `${activity.id}-${index}`}>
                <b>{step.startTime?`${step.startTime} · `:''}{step.title}</b>
                {[step.place,step.notes].filter(Boolean).length>0&&<span> {[step.place,step.notes].filter(Boolean).join(' · ')}</span>}
              </li>)}
            </ol>}
          </div>
        </div>)}
      </div>)}
      {!dates.length&&<p className="print-empty">No hay actividades cargadas.</p>}
    </section>

    <section className="print-section">
      <h2>Presupuesto</h2>
      {expenses.length?<table className="print-table">
        <thead><tr><th>Concepto</th><th>Estado</th><th className="print-number">Total grupo</th></tr></thead>
        <tbody>{expenses.map(expense=><tr key={expense.id}>
          <td><strong>{expense.title}</strong><small>{canonicalItemCategory(expense.category)}{expense.included===false?' · Fuera del total':''}</small></td>
          <td>{expenseStatuses[expense.status]}</td>
          <td className="print-number">{money(expenseTotal(expense),trip.currency)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={2}>Total incluido</th><th className="print-number">{money(groupBudget,trip.currency)}</th></tr></tfoot>
      </table>:<p className="print-empty">No hay gastos cargados.</p>}
    </section>

    <section className="print-section">
      <h2>Reservas</h2>
      {sortedReservations.length?<div className="print-list">{sortedReservations.map(reservation=><div key={reservation.id}>
        <strong>{reservation.title}</strong>
        <p>{[reservationStatuses[reservation.status],reservation.dueDate?`Fecha límite: ${dateLabel(reservation.dueDate)}`:'',reservation.notes].filter(Boolean).join(' · ')}</p>
      </div>)}</div>:<p className="print-empty">No hay reservas cargadas.</p>}
    </section>

    <section className="print-section">
      <h2>Lugares</h2>
      {visiblePlaces.length?<div className="print-list print-places">{visiblePlaces.map(place=><div key={place.id}>
        <strong>{place.name}{place.isBase?' · Base del viaje':''}</strong>
        <p>{[place.address,canonicalItemCategory(place.category),place.notes].filter(Boolean).join(' · ')}</p>
      </div>)}</div>:<p className="print-empty">No hay lugares guardados.</p>}
    </section>

    <footer className="print-footer">La valija personal y los datos de acceso de los integrantes no forman parte de este documento.</footer>
  </article>
}
