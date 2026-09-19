import { Fragment } from 'react'
import { occurrenceEndDate } from '@/lib/activity-dates'
import { longDateLabel, tripDateRangeLabel } from '@/lib/date-labels'
import { activitiesForExpense, expenseDates, groupExpensesByDate, MULTI_DATE_EXPENSES, UNDATED_EXPENSES } from '@/lib/expense-dates'
import { money } from '@/lib/money'
import { canonicalItemCategory, expenseGroupTotal, sortReservationsForDisplay } from '@/lib/trip-item-rules'
import type { Activity, Expense, Reservation, Trip } from '@/lib/types'

type Props = {
  trip: Trip
  activities: Activity[]
  expenses: Expense[]
  reservations: Reservation[]
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

function activityTime(activity:Activity){
  if(!activity.startTime)return 'Sin hora'
  return activity.endTime?`${activity.startTime} a ${activity.endTime}`:activity.startTime
}

export default function TripPrintView({trip,activities,expenses,reservations}:Props){
  const travelers=Math.max(1,trip.travelerCount || 1)
  const sortedActivities=[...activities].sort((a,b)=>
    a.date.localeCompare(b.date) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') ||
    (a.position ?? 0)-(b.position ?? 0) || a.title.localeCompare(b.title,'es')
  )
  const dates=[...new Set(sortedActivities.map(activity=>activity.date))]
  const expenseTotal=(expense:Expense)=>{
    const linkedCount=activitiesForExpense(expense,activities).length
    return expenseGroupTotal(expense,travelers,linkedCount)
  }
  const groupBudget=expenses.filter(expense=>expense.included!==false).reduce((sum,expense)=>sum+expenseTotal(expense),0)
  const expenseGroups=groupExpensesByDate(expenses,activities)
  const sortedReservations=[...reservations].sort(sortReservationsForDisplay)

  return <article className="trip-print-view" aria-label="Plan de viaje para imprimir">
    <header className="print-header">
      <div className="print-brand"><strong>TripMate</strong><span>Plan de viaje</span></div>
      <h1>{trip.name}</h1>
      <p>{trip.destination}{trip.country?` · ${trip.country}`:''}</p>
      <div className="print-summary">
        <div><span>Fechas del viaje</span><strong>{tripDateRangeLabel(trip.startDate,trip.endDate)}</strong></div>
        <div><span>Viajeros</span><strong>{travelers}</strong></div>
        <div><span>Presupuesto individual</span><strong>{money(groupBudget/travelers,trip.currency)}</strong></div>
      </div>
    </header>

    <section className="print-section">
      <h2>Itinerario</h2>
      {dates.map(date=><div className="print-day" key={date}>
        <h3>{longDateLabel(date,true)}</h3>
        {sortedActivities.filter(activity=>activity.date===date).map(activity=><div className="print-activity" key={activity.id}>
          <div className="print-time">{activityTime(activity)}</div>
          <div>
            <strong>{activity.title}{activity.optional?' · Opcional':''}</strong>
            <p>{[
              occurrenceEndDate(activity)!==activity.date?`Finaliza ${longDateLabel(occurrenceEndDate(activity))}`:'',
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
      <h2>Presupuesto individual</h2>
      {expenses.length?<table className="print-table">
        <thead><tr><th>Concepto</th><th>Estado</th><th className="print-number">Por persona</th></tr></thead>
        <tbody>{expenseGroups.map(group=><Fragment key={group.key}>
          <tr className="print-budget-day"><th colSpan={3}>{group.key===MULTI_DATE_EXPENSES?'Varias fechas':group.key===UNDATED_EXPENSES?'Sin día en el itinerario':longDateLabel(group.key,true)}</th></tr>
          {group.expenses.map(expense=><tr key={expense.id}>
            <td><strong>{expense.title}</strong><small>{group.key===MULTI_DATE_EXPENSES?`${expenseDates(expense,activities).map(date=>longDateLabel(date)).join(' · ')} · `:''}{canonicalItemCategory(expense.category)}{expense.included===false?' · Fuera del total':''}</small></td>
            <td>{expenseStatuses[expense.status]}</td>
            <td className="print-number">{money(expenseTotal(expense)/travelers,trip.currency)}</td>
          </tr>)}
        </Fragment>)}</tbody>
        <tfoot><tr><th colSpan={2}>Presupuesto individual</th><th className="print-number">{money(groupBudget/travelers,trip.currency)}</th></tr></tfoot>
      </table>:<p className="print-empty">No hay gastos cargados.</p>}
    </section>

    <section className="print-section">
      <h2>Reservas</h2>
      {sortedReservations.length?<div className="print-list">{sortedReservations.map(reservation=><div key={reservation.id}>
        <strong>{reservation.title}</strong>
        <p>{[reservationStatuses[reservation.status],reservation.dueDate?`Fecha límite: ${longDateLabel(reservation.dueDate)}`:'',reservation.notes].filter(Boolean).join(' · ')}</p>
      </div>)}</div>:<p className="print-empty">No hay reservas cargadas.</p>}
    </section>

    <footer className="print-footer">La valija personal y los datos de acceso de los integrantes no forman parte de este documento.</footer>
  </article>
}
