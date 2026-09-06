import { createClient } from './supabase-client'
import { trips, activities, expenses, reservations, packing } from './demo-data'
import { activityToRow } from './db-mappers'

export async function importCordobaDemo() {
  const supabase=createClient()
  if(!supabase) throw new Error('Supabase no está configurado.')
  const source=trips[0]
  const {data:tripId,error:createError}=await supabase.rpc('create_trip',{
    p_name:source.name,
    p_destination:source.destination,
    p_country:source.country,
    p_start_date:source.startDate,
    p_end_date:source.endDate,
    p_currency:source.currency,
  })
  if(createError)throw createError

  const {data:{user}}=await supabase.auth.getUser()
  const uid=user?.id || null

  const activityRows=activities.filter(a=>a.tripId===source.id).map(a=>({
    ...activityToRow({...a,tripId}),
    created_by:uid,updated_by:uid
  }))
  const expenseRows=expenses.filter(e=>e.tripId===source.id).map(e=>({
    trip_id:tripId,title:e.title,category:e.category,amount:e.amount,currency:source.currency,status:e.status,scope:e.scope,included:e.included!==false,created_by:uid
  }))
  const reservationRows=reservations.filter(r=>r.tripId===source.id).map(r=>({
    trip_id:tripId,title:r.title,status:r.status,priority:r.priority,due_date:r.dueDate||null,amount:r.amount??null,notes:r.notes||null,created_by:uid
  }))
  const packingRows=packing.filter(p=>p.tripId===source.id).map((p,index)=>({
    trip_id:tripId,label:p.label,assigned_to:uid,assigned_label:null,packed:p.packed,category:p.category,position:index,created_by:uid
  }))

  const results=await Promise.all([
    supabase.from('activities').insert(activityRows),
    supabase.from('expenses').insert(expenseRows),
    supabase.from('reservations').insert(reservationRows),
    supabase.from('packing_items').insert(packingRows),
  ])
  const failed=results.find(r=>r.error)
  if(failed?.error)throw failed.error

  await supabase.from('change_log').insert({
    trip_id:tripId,entity_type:'trip',entity_id:tripId,action:'imported',
    summary:'Se importó la planificación inicial de Córdoba 2026.'
  })
  return tripId as string
}
