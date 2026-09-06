'use client'
import { useEffect, useMemo, useState } from 'react'
import { AppBar } from './AppBar'
import ExpenseModal from './ExpenseModal'
import InviteModal from './InviteModal'
import PackingItemModal from './PackingItemModal'
import QuickAddModal from './QuickAddModal'
import { activities as seedActivities, expenses as seedExpenses, packing as seedPacking, reservations as seedReservations, trips as demoTrips } from '@/lib/demo-data'
import { Activity, Expense, PackingItem, Place, Reservation, Trip, ChangeLogItem } from '@/lib/types'
import { money } from '@/lib/money'
import { createClient } from '@/lib/supabase-client'
import { mapActivity, mapExpense, mapPacking, mapPlace, mapReservation, mapTrip } from '@/lib/db-mappers'
import { logChange } from '@/lib/change-log'
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, DollarSign, Edit3, ExternalLink, History, Link2, Luggage, Map as MapIcon, MapPin, Menu, Navigation, Plus, ReceiptText, Share2, Star, Trash2, UserMinus, Users, Wifi, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

const tabs = ['Resumen','Itinerario','Presupuesto','Reservas','Lugares','Valija','Integrantes'] as const
type Tab = typeof tabs[number]
type AddKind = 'expense'|'reservation'|'packing'|'place'|null
type SyncStatus = 'demo'|'syncing'|'synced'|'error'
type TripMember = { id:string; name:string; username?:string; role:'owner'|'editor'|'viewer'; joinedAt?:string }

function dayLabel(date:string){
  return new Date(date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})
}
function shortDate(date:string){
  return new Date(date+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'})
}
function activityStateLabel(status:Activity['status']){
  return ({idea:'Idea',planned:'Planificado',reserved:'Reservado',paid:'Pagado',done:'Hecho'})[status]
}
function activityChip(status:Activity['status']){
  return `status-${status}`
}
function activityCategoryLabel(category:Activity['category']){
  return ({
    transport:'Transporte',
    lodging:'Alojamiento',
    food:'Comida',
    activity:'Actividad',
    museum:'Museo',
    nightlife:'Noche',
    event:'Evento',
    other:'Otro',
  })[category]
}
function reservationLabel(status:Reservation['status']){
  return ({watching:'Esperando',pending:'Pendiente',reserved:'Reservado',paid:'Pagado'})[status]
}
function reservationChip(status:Reservation['status']){
  return `reservation-${status}`
}
function expenseStatusLabel(status:Expense['status']){
  return ({estimated:'',confirmed:'Confirmado',paid:'Pagado'})[status]
}
function roleLabel(role:TripMember['role']){
  return ({owner:'Dueño',editor:'Editor',viewer:'Lector'})[role]
}
function roleDescription(role:TripMember['role']){
  return ({owner:'Organizador del viaje',editor:'Puede editar el viaje',viewer:'Sólo puede consultar'})[role]
}
function placeStatusLabel(status:Place['status']){
  return ({saved:'Guardado',candidate:'Candidato',confirmed:'Confirmado',discarded:'Descartado',visited:'Visitado'})[status]
}
function placeLabel(place:Place, trip:Trip){
  return [place.address || place.name, trip.destination, trip.country].filter(Boolean).join(', ')
}
function mapsSearchUrl(query:string){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
function mapsDirectionsUrl(origin:string,destination:string){
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
}
function timeToMinutes(time?:string){
  if(!time)return null
  const [hours,minutes]=time.split(':').map(Number)
  if(Number.isNaN(hours) || Number.isNaN(minutes))return null
  return hours*60+minutes
}
function activityWindow(activity:Activity){
  const start=timeToMinutes(activity.startTime) ?? 0
  const end=timeToMinutes(activity.endTime) ?? start+90
  return {start,end:Math.max(end,start+30)}
}
function activitiesOverlap(a:Activity,b:Activity){
  if(a.date!==b.date)return false
  const aw=activityWindow(a)
  const bw=activityWindow(b)
  return aw.start < bw.end && bw.start < aw.end
}
function sortActivities(a:Activity,b:Activity){
  const byPosition=(a.position ?? 0)-(b.position ?? 0)
  if(byPosition!==0)return byPosition
  return (a.startTime||'99:99').localeCompare(b.startTime||'99:99')
}
function sortReservations(a:Reservation,b:Reservation){
  const byPosition=(a.position ?? 0)-(b.position ?? 0)
  if(byPosition!==0)return byPosition
  return a.title.localeCompare(b.title)
}
function normalizeMatch(value:string){
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
}
function activityCategoryFromExpense(category:string):Activity['category']{
  const normalized=normalizeMatch(category)
  if(normalized.includes('transporte') || normalized.includes('micro') || normalized.includes('uber') || normalized.includes('taxi'))return 'transport'
  if(normalized.includes('aloj'))return 'lodging'
  if(normalized.includes('comida') || normalized.includes('cena') || normalized.includes('almuerzo'))return 'food'
  if(normalized.includes('museo'))return 'museum'
  if(normalized.includes('salida') || normalized.includes('noche') || normalized.includes('boliche'))return 'nightlife'
  if(normalized.includes('entrada') || normalized.includes('recital'))return 'event'
  return 'activity'
}
function statusFromExpense(status:Expense['status']):Activity['status']{
  if(status==='paid')return 'paid'
  if(status==='confirmed')return 'reserved'
  return 'planned'
}
function uniqueCategories(existing:string[], fallback:string[]=[]){
  const seen=new Set<string>()
  return [...existing,...fallback]
    .map(category=>category.trim())
    .filter(category=>{
      if(!category || seen.has(category.toLowerCase()))return false
      seen.add(category.toLowerCase())
      return true
    })
}
function demoTripFor(id:string):Trip{
  return demoTrips.find(t=>t.id===id) || {
    id,name:'Viaje demo',destination:'Destino',country:'',startDate:new Date().toISOString().slice(0,10),
    endDate:new Date().toISOString().slice(0,10),currency:'ARS',status:'planning',memberNames:['Demo'],role:'owner'
  }
}

export default function TripWorkspace({tripId}:{tripId:string}){
  const router=useRouter()
  const [trip,setTrip]=useState<Trip>(demoTripFor(tripId))
  const [tab,setTab]=useState<Tab>('Resumen')
  const [acts,setActs]=useState<Activity[]>(seedActivities.filter(x=>x.tripId===tripId))
  const [exp,setExp]=useState<Expense[]>(seedExpenses.filter(x=>x.tripId===tripId))
  const [res,setRes]=useState<Reservation[]>(seedReservations.filter(x=>x.tripId===tripId))
  const [pack,setPack]=useState<PackingItem[]>(seedPacking.filter(x=>x.tripId===tripId))
  const [places,setPlaces]=useState<Place[]>([])
  const [members,setMembers]=useState<TripMember[]>([])
  const [changes,setChanges]=useState<ChangeLogItem[]>([])
  const [editingExpense,setEditingExpense]=useState<Expense|null>(null)
  const [editingPacking,setEditingPacking]=useState<PackingItem|null>(null)
  const [expenseToDelete,setExpenseToDelete]=useState<Expense|null>(null)
  const [packingToDelete,setPackingToDelete]=useState<PackingItem|null>(null)
  const [inviteOpen,setInviteOpen]=useState(false)
  const [memberToRemove,setMemberToRemove]=useState<TripMember|null>(null)
  const [addKind,setAddKind]=useState<AddKind>(null)
  const [expenseCategoryFilter,setExpenseCategoryFilter]=useState<string|null>(null)
  const [expenseAmountDrafts,setExpenseAmountDrafts]=useState<Record<string,string>>({})
  const [mobileMoreOpen,setMobileMoreOpen]=useState(false)
  const [currentUserId,setCurrentUserId]=useState<string|null>(null)
  const [hydrated,setHydrated]=useState(false)
  const [connected,setConnected]=useState(false)
  const [syncStatus,setSyncStatus]=useState<SyncStatus>('demo')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const storageKey=`tripmate-demo:${tripId}`

  async function loadConnectedData(silent=false){
    const supabase=createClient()
    if(!supabase)return false
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace(`/login?next=${encodeURIComponent(`/trip/${tripId}`)}`);return true}
    setCurrentUserId(user.id)
    setConnected(true)
    setSyncStatus('syncing')
    if(!silent)setLoading(true)

    const {data:tripRow,error:tripError}=await supabase.from('trips').select('*').eq('id',tripId).single()
    if(tripError){
      setError('No pudimos abrir este viaje. Verificá que seas integrante o que la invitación sea válida.')
      setSyncStatus('error')
      setLoading(false);return true
    }

    const [membersQ,actsQ,expQ,resQ,placesQ,packQ,logQ]=await Promise.all([
      supabase.from('trip_members').select('role,user_id,joined_at').eq('trip_id',tripId),
      supabase.from('activities').select('*').eq('trip_id',tripId).order('date').order('start_time'),
      supabase.from('expenses').select('*').eq('trip_id',tripId).order('created_at'),
      supabase.from('reservations').select('*').eq('trip_id',tripId).order('position').order('created_at'),
      supabase.from('places').select('*').eq('trip_id',tripId).order('is_base',{ascending:false}).order('created_at'),
      supabase.from('packing_items').select('*').eq('trip_id',tripId).eq('assigned_to',user.id).order('position').order('created_at'),
      supabase.from('change_log').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}).limit(8),
    ])

    const members=(membersQ.data||[]) as any[]
    const queryError=[membersQ,actsQ,expQ,resQ,placesQ,packQ,logQ].find(result=>result.error)?.error
    if(queryError){
      setError(`No pudimos sincronizar todos los datos: ${queryError.message}`)
      setSyncStatus('error')
      setLoading(false)
      return true
    }
    const memberIds=members.map(m=>m.user_id)
    const {data:profileRows}=memberIds.length?await supabase.from('profiles').select('id,display_name,username').in('id',memberIds):{data:[] as any[]}
    const nameById=new Map<string,string>((profileRows||[]).map((p:any)=>[String(p.id),String(p.display_name || 'Viajero')]))
    const usernameById=new Map<string,string>((profileRows||[]).map((p:any)=>[String(p.id),String(p.username || '')]))
    const names:string[]=memberIds.map((id:string)=>nameById.get(id) || 'Viajero')
    const myRole=members.find(m=>m.user_id===user.id)?.role
    setMembers(members.map((m:any)=>({id:String(m.user_id),name:nameById.get(String(m.user_id)) || 'Viajero',username:usernameById.get(String(m.user_id)) || undefined,role:m.role,joinedAt:m.joined_at})))
    setTrip(mapTrip(tripRow,names,myRole))
    const mappedActivities=(actsQ.data||[]).map(mapActivity)
    const mappedExpenses=(expQ.data||[]).map(mapExpense)
    setActs(mappedActivities)
    setExp(mappedExpenses)
    setRes((resQ.data||[]).map(mapReservation))
    setPlaces((placesQ.data||[]).map(mapPlace))
    setPack((packQ.data||[]).map(mapPacking))
    setChanges((logQ.data||[]).map((r:any)=>({
      id:r.id,tripId:r.trip_id,entityType:r.entity_type,entityId:r.entity_id,action:r.action,summary:r.summary,createdAt:r.created_at
    })))
    setSyncStatus('synced')
    setLoading(false)
    return true
  }

  useEffect(()=>{
    let cancelled=false
    async function start(){
      const connectedNow=await loadConnectedData()
      if(cancelled)return
      if(connectedNow)return
      try{
        const raw=localStorage.getItem(storageKey)
        if(raw){
          const d=JSON.parse(raw)
          if(d.trip)setTrip(d.trip)
          if(d.acts)setActs(d.acts)
          if(d.exp)setExp(d.exp)
          if(d.res)setRes(d.res)
          if(d.places)setPlaces(d.places)
          if(d.pack)setPack(d.pack)
        }
      }catch{}
      setHydrated(true);setLoading(false)
    }
    start()
    return()=>{cancelled=true}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tripId])

  useEffect(()=>{
    if(connected||!hydrated)return
    localStorage.setItem(storageKey,JSON.stringify({trip,acts,exp,res,places,pack}))
  },[trip,acts,exp,res,places,pack,hydrated,connected,storageKey])

  useEffect(()=>{
    if(!connected)return
    const supabase=createClient()
    if(!supabase)return
    let timer:ReturnType<typeof setTimeout>|undefined
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>loadConnectedData(true),180)}
    const channel=supabase.channel(`trip-${tripId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'activities',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'expenses',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'places',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'packing_items',filter:`trip_id=eq.${tripId}`},refresh)
      .subscribe(status=>{
        if(status==='SUBSCRIBED')setSyncStatus('synced')
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setSyncStatus('error')
      })
    return()=>{clearTimeout(timer);supabase.removeChannel(channel)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[connected,tripId])

  const isExpenseLinked=(expense:Expense)=>Boolean(expense.activityId && acts.some(activity=>activity.id===expense.activityId))
  const isExpenseIncluded=(expense:Expense)=>expense.included!==false
  const travellers=Math.max(1,trip.memberNames.length || 1)
  const expenseGroupAmount=(expense:Expense)=>expense.amountBasis==='group'?expense.amount:expense.amount*travellers
  const groupBudget=exp.filter(isExpenseIncluded).reduce((sum,expense)=>sum+expenseGroupAmount(expense),0)
  const perPersonBudget=groupBudget/travellers
  const fixedBudget=perPersonBudget
  const visibleActivities=acts.filter(activity=>exp.some(expense=>expense.activityId===activity.id && isExpenseIncluded(expense)))
  const pendingReservations=res.filter(r=>r.status==='pending'||r.status==='watching').length
  const packedCount=pack.filter(p=>p.packed).length
  const pctPacked=pack.length?Math.round((packedCount/pack.length)*100):0
  const dates:string[]=[...new Set<string>(visibleActivities.map(a=>a.date))].sort()
  const canEdit=trip.role!=='viewer'
  const canManagePacking=Boolean(trip.role)
  const isOwner=trip.role==='owner'
  const basePlace=places.find(p=>p.isBase) || places.find(p=>/aloj|hotel|hostel|depart|base/i.test(`${p.category} ${p.name}`))
  const alternativesFor=(activity:Activity)=>visibleActivities
    .filter(candidate=>candidate.id!==activity.id && candidate.date===activity.date && (candidate.optional || candidate.status==='idea') && activitiesOverlap(activity,candidate))
    .sort(sortActivities)

  const groupedExpenses=useMemo<[string,number][]>(()=>{
    const m=new Map<string,number>()
    exp.filter(isExpenseIncluded).forEach(e=>m.set(e.category,(m.get(e.category)||0)+(expenseGroupAmount(e)/travellers)))
    return [...m.entries()].sort((a,b)=>b[1]-a[1])
  },[exp,travellers])
  const expenseCategories=useMemo(()=>uniqueCategories(exp.map(e=>e.category),['Transporte','Alojamiento','Comidas','Salidas','Paseos','Entradas','Otros']),[exp])
  const packingCategories=useMemo(()=>uniqueCategories(pack.map(p=>p.category),['Ropa','Documentos','Tecnología','Cuidado','Organización','General']),[pack])
  const placeCategories=useMemo(()=>uniqueCategories(places.map(p=>p.category),['Alojamiento','Comida','Paseo','Transporte','Noche','Compras','Otro']),[places])
  const maxExpense=Math.max(...groupedExpenses.map(x=>x[1]),1)
  const activityById=useMemo(()=>new Map(acts.map(activity=>[activity.id,activity])),[acts])
  const expenseByActivityId=useMemo(()=>new Map(exp.filter(expense=>expense.activityId).map(expense=>[expense.activityId as string,expense])),[exp])
  const sortedExpenses=useMemo(()=>[...exp].sort((a,b)=>{
    const aActivity=a.activityId?activityById.get(a.activityId):undefined
    const bActivity=b.activityId?activityById.get(b.activityId):undefined
    const aDate=a.date || aActivity?.date || '9999-12-31'
    const bDate=b.date || bActivity?.date || '9999-12-31'
    if(aDate!==bDate)return aDate.localeCompare(bDate)
    const aTime=a.startTime || aActivity?.startTime || '99:99'
    const bTime=b.startTime || bActivity?.startTime || '99:99'
    if(aTime!==bTime)return aTime.localeCompare(bTime)
    return a.title.localeCompare(b.title)
  }),[exp,activityById])
  const visibleExpenses=useMemo(()=>expenseCategoryFilter?sortedExpenses.filter(expense=>expense.category===expenseCategoryFilter):sortedExpenses,[sortedExpenses,expenseCategoryFilter])
  const expensesByDay=useMemo(()=>{
    const groups=new Map<string,Expense[]>()
    visibleExpenses.forEach(expense=>{
      const activity=expense.activityId?activityById.get(expense.activityId):undefined
      const key=expense.date || activity?.date || 'sin-fecha'
      groups.set(key,[...(groups.get(key)||[]),expense])
    })
    return [...groups.entries()]
  },[visibleExpenses,activityById])

  function expenseRpcPayload(expense:Expense){
    return {
      p_expense_id:expense.id.startsWith('e-')?null:expense.id,
      p_trip_id:trip.id,
      p_title:expense.title,
      p_category:expense.category,
      p_amount:expense.amount,
      p_status:expense.status,
      p_included:expense.included!==false,
      p_amount_basis:expense.amountBasis || 'per_person',
      p_date:expense.date || null,
      p_start_time:expense.startTime || null,
      p_end_time:expense.endTime || null,
      p_place:expense.place || null,
      p_notes:expense.notes || null,
      p_optional:Boolean(expense.optional),
    }
  }
  async function persistExpense(id:string,amountOverride?:number){
    const current=exp.find(e=>e.id===id)
    const supabase=createClient()
    if(!current)return
    const next={...current,amount:amountOverride ?? current.amount}
    if(!Number.isFinite(next.amount) || next.amount<0){setError('El importe debe ser cero o mayor.');return}
    setExp(items=>items.map(expense=>expense.id===id?next:expense))
    if(!supabase)return
    const {error}=await supabase.rpc('save_expense_plan',expenseRpcPayload(next))
    if(error){setError(error.message);await loadConnectedData(true);return}
    await loadConnectedData(true)
    await logChange(trip.id,'expense',id,'updated',`Se actualizó “${next.title}” a ${money(next.amount,trip.currency)}.`)
  }
  async function commitExpenseAmount(expense:Expense){
    const raw=expenseAmountDrafts[expense.id]
    if(raw===undefined)return
    const amount=Number(raw)
    setExpenseAmountDrafts(current=>{const next={...current};delete next[expense.id];return next})
    if(!raw.trim() || !Number.isFinite(amount) || amount<0){
      setError('El importe debe ser cero o mayor. No se guardó el cambio.')
      return
    }
    await persistExpense(expense.id,amount)
  }

  async function saveExpense(expense:Expense){
    const next={...expense,title:expense.title.trim(),category:expense.category.trim(),amountBasis:expense.amountBasis || 'per_person'}
    if(!next.title)throw new Error('El nombre no puede estar vacío.')
    if(!next.category)throw new Error('La categoría no puede estar vacía.')
    if(!Number.isFinite(next.amount) || next.amount<0)throw new Error('El importe debe ser cero o mayor.')
    const supabase=createClient()
    if(!supabase){
      let activityId=next.activityId || null
      if(next.date){
        const activity:Activity={id:activityId || `a-${Date.now()}`,tripId:trip.id,date:next.date,startTime:next.startTime,endTime:next.endTime,title:next.title,category:activityCategoryFromExpense(next.category),place:next.place,notes:next.notes,estimatedCost:next.amount,actualCost:next.status==='paid'?next.amount:null,costScope:next.amountBasis==='group'?'shared':'per_person',status:statusFromExpense(next.status),optional:Boolean(next.optional)}
        activityId=activity.id
        setActs(current=>current.some(item=>item.id===activity.id)?current.map(item=>item.id===activity.id?activity:item):[...current,activity])
      }else if(activityId){
        setActs(current=>current.filter(item=>item.id!==activityId))
        activityId=null
      }
      setExp(current=>current.map(item=>item.id===next.id?{...next,activityId}:item))
      setEditingExpense(null)
      return
    }
    const {error}=await supabase.rpc('save_expense_plan',expenseRpcPayload(next))
    if(error)throw new Error(error.message)
    await loadConnectedData(true)
    setEditingExpense(null)
    await logChange(trip.id,'expense',next.id,'updated',`Se actualizó el gasto “${next.title}”.`)
  }

  async function confirmDeleteExpense(){
    const expense=expenseToDelete
    if(!expense || !canEdit)return
    const supabase=createClient()
    if(!supabase){
      setExpenseToDelete(null)
      setExp(current=>current.filter(e=>e.id!==expense.id))
      setActs(current=>current.filter(activity=>activity.id!==expense.activityId))
      return
    }
    const {error}=await supabase.rpc('delete_expense_plan',{p_expense_id:expense.id,p_trip_id:trip.id})
    if(error){setError(error.message);return}
    setExpenseToDelete(null)
    await loadConnectedData(true)
    await logChange(trip.id,'expense',expense.id,'deleted',`Se eliminó el gasto “${expense.title}”.`)
  }

  async function toggleExpenseIncluded(id:string){
    const current=exp.find(e=>e.id===id);if(!current)return
    const included=current.included===false
    setExp(c=>c.map(e=>e.id===id?{...e,included}:e))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('expenses').update({included}).eq('id',id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'expense',id,'updated',`${included?'Se incluyó':'Se excluyó'} “${current.title}” del presupuesto.`)
  }

  async function togglePacking(id:string){
    const current=pack.find(p=>p.id===id);if(!current)return
    const next=!current.packed
    setPack(c=>c.map(p=>p.id===id?{...p,packed:next}:p))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('packing_items').update({packed:next}).eq('id',id)
    if(error){setError(error.message);await loadConnectedData(true);return}
  }

  async function savePacking(item:PackingItem){
    if(!canManagePacking)return
    const next={...item,label:item.label.trim(),category:item.category.trim() || 'General'}
    const supabase=createClient()
    if(!supabase){
      setPack(current=>current.map(p=>p.id===next.id?next:p))
      setEditingPacking(null)
      return
    }
    const {error}=await supabase.from('packing_items').update({label:next.label,category:next.category}).eq('id',next.id)
    if(error)throw new Error(error.message)
    setPack(current=>current.map(p=>p.id===next.id?next:p))
    setEditingPacking(null)
  }

  async function confirmDeletePacking(){
    const item=packingToDelete
    if(!item || !canManagePacking)return
    setPackingToDelete(null)
    setPack(current=>current.filter(p=>p.id!==item.id))
    const supabase=createClient()
    if(!supabase)return
    const {error}=await supabase.from('packing_items').delete().eq('id',item.id)
    if(error){setError(error.message);await loadConnectedData(true);return}
  }

  async function cycleReservation(id:string){
    const current=res.find(r=>r.id===id);if(!current)return
    const order:Reservation['status'][]=['watching','pending','reserved','paid']
    const status=order[(order.indexOf(current.status)+1)%order.length]
    setRes(c=>c.map(r=>r.id===id?{...r,status}:r))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('reservations').update({status}).eq('id',id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'reservation',id,'updated',`“${current.title}” pasó a ${reservationLabel(status)}.`)
  }

  async function moveReservation(reservation:Reservation,direction:-1|1){
    if(!canEdit)return
    const ordered=[...res].sort(sortReservations)
    const index=ordered.findIndex(item=>item.id===reservation.id)
    const swapIndex=index+direction
    if(index<0 || swapIndex<0 || swapIndex>=ordered.length)return
    const current=ordered[index]
    const target=ordered[swapIndex]
    const currentPosition=index
    const targetPosition=swapIndex
    setRes(items=>items.map(item=>{
      if(item.id===current.id)return {...item,position:targetPosition}
      if(item.id===target.id)return {...item,position:currentPosition}
      return item
    }))
    const supabase=createClient()
    if(!supabase)return
    const {error}=await supabase.rpc('move_reservation',{p_reservation_id:reservation.id,p_trip_id:trip.id,p_direction:direction})
    if(error){setError(error.message);await loadConnectedData(true);return}
    await loadConnectedData(true)
    await logChange(trip.id,'reservation',reservation.id,'updated',`Se reordenó “${reservation.title}”.`)
  }

  async function addQuick(payload:any){
    const supabase=createClient()
    if(addKind==='expense'){
      const item:Expense={id:`e-${Date.now()}`,tripId:trip.id,activityId:null,title:payload.title,category:payload.category,amount:payload.amount,amountBasis:payload.amountBasis || 'per_person',status:'estimated',scope:'per_person',currency:trip.currency,included:false,date:payload.date || undefined,startTime:payload.startTime || undefined,endTime:payload.endTime || undefined,place:payload.place || undefined,notes:payload.notes || undefined,optional:Boolean(payload.optional)}
      if(!supabase){
        if(item.date){
          const activity:Activity={id:`a-${Date.now()}`,tripId:trip.id,date:item.date,startTime:item.startTime,endTime:item.endTime,title:item.title,category:activityCategoryFromExpense(item.category),place:item.place,notes:item.notes,estimatedCost:item.amount,actualCost:null,costScope:item.amountBasis==='group'?'shared':'per_person',status:'planned',optional:item.optional}
          item.activityId=activity.id
          setActs(c=>[...c,activity])
        }
        setExp(c=>[...c,item]);return
      }
      const {data,error}=await supabase.rpc('save_expense_plan',expenseRpcPayload(item))
      if(error)throw error
      await loadConnectedData(true)
      await logChange(trip.id,'expense',data,'created',`Se agregó el gasto “${item.title}”.`)
    }
    if(addKind==='reservation'){
      const nextPosition=res.length?Math.max(...res.map(item=>item.position ?? 0))+1:0
      const item:Reservation={id:`r-${Date.now()}`,tripId:trip.id,title:payload.title,status:'pending',priority:payload.priority,amount:payload.amount||undefined,position:nextPosition}
      if(!supabase){setRes(c=>[...c,item]);return}
      const {data,error}=await supabase.from('reservations').insert({trip_id:trip.id,title:item.title,status:'pending',priority:item.priority,amount:item.amount||null,position:nextPosition}).select('*').single()
      if(error)throw error
      setRes(c=>[...c,mapReservation(data)])
      await logChange(trip.id,'reservation',data.id,'created',`Se agregó la reserva “${item.title}”.`)
    }
    if(addKind==='packing'){
      const item:PackingItem={id:`p-${Date.now()}`,tripId:trip.id,assignedToId:currentUserId,label:payload.title,assignedTo:'Personal',packed:false,category:payload.category||'General'}
      if(!supabase){setPack(c=>[...c,item]);return}
      const {data:{user}}=await supabase.auth.getUser()
      const {data,error}=await supabase.from('packing_items').insert({trip_id:trip.id,label:item.label,assigned_to:user?.id||null,assigned_label:null,packed:false,category:item.category,created_by:user?.id||null}).select('*').single()
      if(error)throw error
      setPack(c=>[...c,mapPacking(data)])
    }
    if(addKind==='place'){
      const item:Place={id:`pl-${Date.now()}`,tripId:trip.id,name:payload.title,category:payload.category||'General',address:payload.address||undefined,url:payload.url||undefined,notes:payload.notes||undefined,status:'saved',isBase:false}
      if(!supabase){setPlaces(c=>[...c,item]);return}
      const {data,error}=await supabase.from('places').insert({trip_id:trip.id,name:item.name,category:item.category,address:item.address||null,url:item.url||null,notes:item.notes||null,status:'saved',is_base:false}).select('*').single()
      if(error)throw error
      setPlaces(c=>[...c,mapPlace(data)])
      await logChange(trip.id,'place',data.id,'created',`Se agregó el lugar “${item.name}”.`)
    }
  }

  async function setBasePlace(place:Place){
    if(!canEdit)return
    setPlaces(current=>current.map(p=>({...p,isBase:p.id===place.id})))
    const supabase=createClient()
    if(!supabase)return
    const clear=await supabase.from('places').update({is_base:false}).eq('trip_id',trip.id)
    if(clear.error){setError(clear.error.message);await loadConnectedData(true);return}
    const {error}=await supabase.from('places').update({is_base:true}).eq('id',place.id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'place',place.id,'updated',`Se marcó “${place.name}” como base del viaje.`)
  }

  async function confirmRemoveMember(){
    const member=memberToRemove
    if(!member || trip.role!=='owner' || member.role==='owner')return
    setMemberToRemove(null)
    const supabase=createClient()
    if(!supabase)return
    const {error}=await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id',trip.id)
      .eq('user_id',member.id)
    if(error){setError(error.message);return}
    await logChange(trip.id,'member',null,'removed',`Se expulsó a ${member.name} del viaje.`)
    await loadConnectedData(true)
  }

  async function updateMemberRole(member:TripMember, role:TripMember['role']){
    if(trip.role!=='owner' || member.role==='owner' || role==='owner' || role===member.role)return
    setMembers(current=>current.map(m=>m.id===member.id?{...m,role}:m))
    const supabase=createClient()
    if(!supabase)return
    const {error}=await supabase
      .from('trip_members')
      .update({role})
      .eq('trip_id',trip.id)
      .eq('user_id',member.id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'member',null,'updated',`${member.name} ahora tiene rol ${roleLabel(role)}.`)
  }

  if(loading)return <div className="shell"><AppBar/><main className="container workspace-skeleton" aria-busy="true" aria-label="Cargando viaje"><div className="skeleton-block skeleton-hero"/><div className="skeleton-block skeleton-tabs"/><div className="two-col"><div className="panel">{[0,1,2,3].map(item=><div className="skeleton-row" key={item}><div className="skeleton-line wide"/><div className="skeleton-line"/></div>)}</div><div className="panel"><div className="skeleton-line wide"/><div className="skeleton-block skeleton-summary"/></div></div></main></div>

  return <div className="shell">
    <AppBar/>
    <main className="container">
      {error&&<div className="notice error dismissible">{error}<button onClick={()=>setError('')}>×</button></div>}
      <section className="hero">
        <div className="hero-head">
          <div>
            <div className="eyebrow">Viaje compartido · {travellers} {travellers===1?'viajero':'viajeros'}</div>
            <h1>{trip.name}</h1>
            <p><MapPin size={14} style={{verticalAlign:'-2px'}}/> {trip.destination} · {shortDate(trip.startDate)} — {shortDate(trip.endDate)}</p>
          </div>
          <div className="hero-actions">
            {isOwner&&<button className="btn btn-secondary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
            <div className={`sync-badge ${syncStatus==='synced'?'online':'demo'}`} title={syncStatus==='error'?'No se pudieron sincronizar todos los cambios':undefined}>{syncStatus==='synced'?<><Wifi size={13}/> Sincronizado</>:syncStatus==='syncing'?<><Wifi size={13}/> Sincronizando…</>:syncStatus==='error'?<><WifiOff size={13}/> Sin conexión</>:<><WifiOff size={13}/> Demo</>}</div>
            <div style={{display:'flex',marginLeft:2}}>{trip.memberNames.map((n,i)=><div key={`${n}-${i}`} className="avatar" title={n} style={{marginLeft:i?-8:0,border:'2px solid rgba(255,255,255,.6)',background:i?'#f1d9e8':'#dfe8ff'}}>{n[0]}</div>)}</div>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><span>Por persona estimado</span><b>{money(perPersonBudget,trip.currency)}</b></div>
          <div className="stat"><span>Total grupo</span><b>{money(groupBudget,trip.currency)}</b></div>
          <div className="stat"><span>Reservas pendientes</span><b>{pendingReservations}</b></div>
          <div className="stat"><span>Valija lista</span><b>{pctPacked}%</b></div>
        </div>
      </section>

      <nav className="tabs" aria-label="Secciones del viaje">
        {tabs.map(t=><button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</button>)}
      </nav>

      {tab==='Resumen' && <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Próximos hitos</h3><div className="muted subcopy">Lo importante del viaje, sin leer todo el itinerario.</div></div><button className="btn btn-ghost" onClick={()=>setTab('Itinerario')}>Ver todo</button></div>
          <div className="list">
            {visibleActivities.filter(a=>['reserved','paid'].includes(a.status)||['event','lodging'].includes(a.category)).slice(0,6).map(a=><div className="list-row" key={a.id}>
              <div><strong>{a.title}</strong><small>{shortDate(a.date)} {a.startTime?`· ${a.startTime}`:''} {a.place?`· ${a.place}`:''}</small></div>
              <span className={`chip ${activityChip(a.status)}`}>{activityStateLabel(a.status)}</span>
            </div>)}
            {!visibleActivities.length&&<div className="empty compact">Todavía no hay gastos incluidos con día de itinerario.</div>}
          </div>
        </section>
        <aside style={{display:'grid',gap:18}}>
          <section className="panel">
            <div className="panel-head"><h3>Presupuesto</h3><ReceiptText size={18} className="muted"/></div>
            <div className="summary-money">{money(perPersonBudget,trip.currency)}</div><div className="money-sub">por persona · {money(groupBudget,trip.currency)} total grupo</div>
            {groupedExpenses.slice(0,4).map(([cat,amount])=><div className="bar-row" key={cat}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></div>)}
          </section>
          {isOwner&&<section className="panel">
            <div className="panel-head"><h3>Actividad reciente</h3><History size={18} className="muted"/></div>
            {connected&&changes.length?<div className="list">{changes.slice(0,5).map(c=><div className="change-row" key={c.id}><span className="change-dot"/><div><strong>{c.summary || c.action}</strong><small>{new Date(c.createdAt).toLocaleString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div></div>)}</div>:<div className="muted" style={{fontSize:13}}>Cuando usen Supabase, acá verán qué cambió el grupo.</div>}
          </section>}
        </aside>
      </div>}

      {tab==='Itinerario' && <section className="panel">
        <div className="panel-head"><div><h3>Itinerario</h3><div className="muted subcopy">Se arma con los gastos incluidos que tienen día y horario cargados en Presupuesto.</div></div></div>
        {dates.map(date=><div className="timeline-day" key={date}>
          <div className="day-heading"><strong style={{textTransform:'capitalize'}}>{dayLabel(date)}</strong><span>{visibleActivities.filter(a=>a.date===date).length} actividades</span></div>
          {visibleActivities.filter(a=>a.date===date).sort(sortActivities).map((a,index,dayActs)=><div key={a.id} className="activity" style={{width:'100%',background:'transparent',borderLeft:0,borderRight:0,borderBottom:0,textAlign:'left',color:'inherit'}}>
            <div className="activity-time">
              <span className="time-start">{a.startTime||'—'}</span>
              {a.endTime&&<><span className="time-to">a</span><span className="time-end">{a.endTime}</span></>}
            </div>
            <div><div className="activity-title">{a.title} {a.optional?<span className="chip optional">Opcional</span>:null}</div><div className="activity-sub">{a.place}{a.place&&a.notes?' · ':''}{a.notes}</div><div className="chips"><span className={`chip ${activityChip(a.status)}`}>{activityStateLabel(a.status)}</span><span className="chip category-chip">{activityCategoryLabel(a.category)}</span></div>
              {a.optional&&alternativesFor(a).length>0&&<div className="alternatives-box">
                <span>Alternativas para este horario</span>
                <div>{alternativesFor(a).slice(0,3).map(alt=><span className="alternative-pill" key={alt.id}>{alt.startTime||'Sin hora'} · {alt.title}</span>)}</div>
              </div>}
            </div>
            <div className="activity-side"><div className="price">{money(a.actualCost ?? a.estimatedCost,trip.currency)}</div>{canEdit&&expenseByActivityId.get(a.id)&&<button className="icon-btn" title={`Editar ${a.title} en Presupuesto`} aria-label={`Editar ${a.title} en Presupuesto`} onClick={()=>setEditingExpense(expenseByActivityId.get(a.id)!)}><Edit3 size={16}/></button>}</div>
          </div>)}
        </div>)}
        {!dates.length&&<div className="empty"><h3>Itinerario vacío</h3><p>Agregá o editá un gasto en Presupuesto, cargale día y marcá incluir para que aparezca acá.</p>{canEdit&&<button className="btn btn-primary" onClick={()=>setTab('Presupuesto')}>Ir a Presupuesto</button>}</div>}
      </section>}

      {tab==='Presupuesto' && <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Presupuesto editable</h3><div className="muted subcopy">Cada gasto indica si el importe es por persona o por todo el grupo.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('expense')}><Plus size={16}/> Gasto</button>}</div>
          {expenseCategoryFilter&&<div className="filter-notice">Mostrando gastos de <b>{expenseCategoryFilter}</b><button onClick={()=>setExpenseCategoryFilter(null)}>Ver todos</button></div>}
          <div className="budget-days">{expensesByDay.map(([date,items])=><div className="budget-day" key={date}>
            <div className="day-heading budget-day-heading"><strong>{date==='sin-fecha'?'Sin día en itinerario':dayLabel(date)}</strong><span>{items.length} {items.length===1?'gasto':'gastos'}</span></div>
            <div className="list">{items.map(e=>{const status=expenseStatusLabel(e.status);const linked=isExpenseLinked(e);const included=isExpenseIncluded(e);const activity=e.activityId?activityById.get(e.activityId):undefined;return <div className={`list-row budget-line ${!included?'excluded':''}`} key={e.id} style={{alignItems:'center'}}><div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className={`budget-check ${included?'on':''}`} disabled={!canEdit} onClick={()=>toggleExpenseIncluded(e.id)} aria-label={`${included?'Excluir':'Incluir'} ${e.title}`}>{included?'✓':''}</button><div><strong>{e.title}</strong><small>{[e.startTime||activity?.startTime,e.place||activity?.place,e.category,e.amountBasis==='group'?'total grupo':'por persona',status,!linked?'sin día en itinerario':!included?'fuera del total':''].filter(Boolean).join(' · ')}</small></div></div><div className="budget-actions"><div className="money-input"><span>{trip.currency}</span><input aria-label={`Costo ${e.title}`} disabled={!canEdit} min="0" step="0.01" type="number" value={expenseAmountDrafts[e.id] ?? String(e.amount)} onChange={ev=>setExpenseAmountDrafts(current=>({...current,[e.id]:ev.target.value}))} onBlur={()=>commitExpenseAmount(e)}/></div>{canEdit&&<><button className="icon-btn" title={`Editar ${e.title}`} aria-label={`Editar ${e.title}`} onClick={()=>setEditingExpense(e)}><Edit3 size={16}/></button><button className="icon-btn" title={`Eliminar ${e.title}`} aria-label={`Eliminar ${e.title}`} onClick={()=>setExpenseToDelete(e)}><Trash2 size={16}/></button></>}</div></div>})}</div>
          </div>)}</div>
        </section>
        <aside className="panel">
          <h3>Por persona</h3><div className="summary-money">{money(fixedBudget,trip.currency)}</div><div className="money-sub">{money(fixedBudget*travellers,trip.currency)} total grupo · {travellers} viajeros</div>
          <div className="budget-buffer"><b>+15% recomendado:</b><br/>{money(fixedBudget*1.15,trip.currency)} por persona para absorber cambios e imprevistos.</div>
          {groupedExpenses.map(([cat,amount])=><button className={`bar-row bar-filter ${expenseCategoryFilter===cat?'active':''}`} key={cat} onClick={()=>setExpenseCategoryFilter(current=>current===cat?null:cat)}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></button>)}
        </aside>
      </div>}

      {tab==='Reservas' && <section className="panel">
        <div className="panel-head"><div><h3>Reservas y compras</h3><div className="muted subcopy">Cambien el estado a medida que investigan o compran.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('reservation')}><Plus size={16}/> Reserva</button>}</div>
        <div className="list">{[...res].sort(sortReservations).map((r,index,items)=><div key={r.id} className="list-row reservation-row"><div><strong><span className={`status-dot ${r.status==='reserved'||r.status==='paid'?'done':''}`}/>{r.title}</strong><small>{r.notes || (r.amount?money(r.amount,trip.currency):'')}</small></div><div className="reservation-actions"><button className={`chip status-button ${reservationChip(r.status)}`} disabled={!canEdit} onClick={()=>cycleReservation(r.id)}>{reservationLabel(r.status)}</button>{canEdit&&<><button className="icon-btn" disabled={index===0} title="Subir reserva" aria-label={`Subir ${r.title}`} onClick={()=>moveReservation(r,-1)}><ArrowUp size={16}/></button><button className="icon-btn" disabled={index===items.length-1} title="Bajar reserva" aria-label={`Bajar ${r.title}`} onClick={()=>moveReservation(r,1)}><ArrowDown size={16}/></button></>}</div></div>)}</div>
        {!res.length&&<div className="empty compact">No hay reservas cargadas.</div>}
      </section>}

      {tab==='Lugares' && <div className="two-col places-layout">
        <section className="panel">
          <div className="panel-head"><div><h3>Lugares y rutas</h3><div className="muted subcopy">Guardá alojamientos, puntos de interés y direcciones útiles del viaje.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('place')}><Plus size={16}/> Lugar</button>}</div>
          {!places.length&&<div className="empty compact"><MapIcon size={24}/><h3>Todavía no hay lugares</h3><p>Agregá el alojamiento o algún punto clave para armar rutas rápidas.</p>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('place')}>Agregar lugar</button>}</div>}
          <div className="list places-list">
            {places.map(place=><div className="list-row place-row" key={place.id}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10,minWidth:0}}>
                <div className={`place-pin ${place.isBase?'base':''}`}>{place.isBase?<Star size={15}/>:<MapPin size={15}/>}</div>
                <div style={{minWidth:0}}>
                  <strong>{place.name}</strong>
                  <small>{place.category}{place.address?` · ${place.address}`:''}</small>
                  {place.notes&&<div className="place-notes">{place.notes}</div>}
                  <div className="chips">{place.isBase&&<span className="chip green">Base</span>}<span className="chip">{placeStatusLabel(place.status)}</span></div>
                </div>
              </div>
              <div className="place-actions">
                <a className="icon-btn" href={mapsSearchUrl(placeLabel(place,trip))} target="_blank" rel="noreferrer" title="Abrir en Google Maps" aria-label={`Abrir ${place.name} en Google Maps`}><ExternalLink size={17}/></a>
                {place.url&&<a className="icon-btn" href={place.url} target="_blank" rel="noreferrer" title="Abrir link guardado" aria-label={`Abrir link guardado de ${place.name}`}><Link2 size={17}/></a>}
                {basePlace&&basePlace.id!==place.id&&<a className="icon-btn" href={mapsDirectionsUrl(placeLabel(basePlace,trip),placeLabel(place,trip))} target="_blank" rel="noreferrer" title="Ruta desde la base" aria-label={`Ruta desde la base hasta ${place.name}`}><Navigation size={17}/></a>}
                {canEdit&&!place.isBase&&<button className="icon-btn" onClick={()=>setBasePlace(place)} title="Marcar como base" aria-label={`Marcar ${place.name} como base`}><Star size={17}/></button>}
              </div>
            </div>)}
          </div>
        </section>
        <aside className="panel">
          <div className="panel-head"><h3>Base del viaje</h3><MapPin size={18} className="muted"/></div>
          {basePlace?<><div className="base-place-name">{basePlace.name}</div><div className="money-sub">{basePlace.address || trip.destination}</div><a className="btn btn-secondary route-wide" href={mapsSearchUrl(placeLabel(basePlace,trip))} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Abrir en Google Maps</a></>:<div className="muted" style={{fontSize:13,lineHeight:1.5}}>Marcá un alojamiento o punto de encuentro como base para calcular rutas externas desde ahí.</div>}
          <div className="route-hint"><b>Rutas externas:</b><br/>En cada lugar podés abrir Google Maps con la ruta desde la base ya cargada.</div>
        </aside>
      </div>}

      {tab==='Valija' && <section className="panel">
        <div className="panel-head"><div><h3>Mi valija</h3><div className="muted subcopy">{packedCount} de {pack.length} listos.</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}>{canManagePacking&&<button className="btn btn-primary" onClick={()=>setAddKind('packing')}><Plus size={16}/> Ítem</button>}<Luggage size={19} className="muted"/></div></div>
        <div className="progress" style={{marginBottom:16}}><i style={{width:`${pctPacked}%`}}/></div>
        <div className="list">{pack.map(p=><div key={p.id} className="list-row packing-row"><div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className="packing-check" disabled={!canManagePacking} onClick={()=>togglePacking(p.id)} aria-label={`${p.packed?'Desmarcar':'Marcar'} ${p.label}`}>{p.packed?<CheckCircle2 size={20} color="var(--green)"/>:<span className="check-empty"/>}</button><div><strong style={{textDecoration:p.packed?'line-through':'none',opacity:p.packed?0.65:1}}>{p.label}</strong><small>{p.category}</small></div></div>{canManagePacking&&<div className="packing-actions"><button className="icon-btn" title={`Editar ${p.label}`} aria-label={`Editar ${p.label}`} onClick={()=>setEditingPacking(p)}><Edit3 size={16}/></button><button className="icon-btn" title={`Eliminar ${p.label}`} aria-label={`Eliminar ${p.label}`} onClick={()=>setPackingToDelete(p)}><Trash2 size={16}/></button></div>}</div>)}</div>
        {!pack.length&&<div className="empty compact">Todavía no cargaste ítems para tu valija.</div>}
      </section>}

      {tab==='Integrantes' && <section className="panel">
        <div className="panel-head">
          <div><h3>Integrantes</h3><div className="muted subcopy">Personas que tienen acceso a este viaje.</div></div>
          {isOwner&&<button className="btn btn-primary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
        </div>
        <div className="list">
          {members.length?members.map(member=><div className="list-row" key={member.id}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div className="avatar">{member.name[0]}</div>
              <div><strong>{member.name}</strong><small>{member.username?`@${member.username} · `:''}{roleDescription(member.role)}{member.joinedAt?` · desde ${shortDate(member.joinedAt.slice(0,10))}`:''}</small></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {isOwner&&member.role!=='owner'?<select className="role-select" value={member.role} onChange={e=>updateMemberRole(member,e.target.value as TripMember['role'])}>
                <option value="editor">Editor</option>
                <option value="viewer">Lector</option>
              </select>:<span className={`chip ${member.role==='owner'?'green':''}`}>{roleLabel(member.role)}</span>}
              {isOwner&&member.role!=='owner'&&<button className="icon-btn" title={`Expulsar a ${member.name}`} aria-label={`Expulsar a ${member.name}`} onClick={()=>setMemberToRemove(member)}><UserMinus size={17}/></button>}
            </div>
          </div>):trip.memberNames.map((name,i)=><div className="list-row" key={`${name}-${i}`}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div className="avatar">{name[0]}</div>
              <div><strong>{name}</strong><small>Integrante del viaje</small></div>
            </div>
          </div>)}
        </div>
      </section>}

      <div className="bottom-nav">
        {(['Resumen','Itinerario','Presupuesto','Valija'] as Tab[]).map((t,i)=>{const Icon=[CalendarDays,Clock3,DollarSign,Luggage][i];return <button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setMobileMoreOpen(false)}}><Icon size={18}/>{t}</button>})}
        <button className={(['Reservas','Lugares','Integrantes'] as Tab[]).includes(tab)||mobileMoreOpen?'active':''} onClick={()=>setMobileMoreOpen(value=>!value)} aria-expanded={mobileMoreOpen}><Menu size={18}/>Más</button>
      </div>
      {mobileMoreOpen&&<div className="mobile-more-menu" role="menu">
        {([['Reservas',ClipboardCheck],['Lugares',MapIcon],['Integrantes',Users]] as const).map(([target,Icon])=><button key={target} role="menuitem" className={tab===target?'active':''} onClick={()=>{setTab(target);setMobileMoreOpen(false)}}><Icon size={18}/>{target}</button>)}
      </div>}

      {editingExpense&&<ExpenseModal expense={editingExpense} activities={acts} categoryOptions={expenseCategories} onClose={()=>setEditingExpense(null)} onSave={saveExpense} onDelete={(expense)=>{setEditingExpense(null);setExpenseToDelete(expense)}}/>}
      {editingPacking&&<PackingItemModal item={editingPacking} categoryOptions={packingCategories} onClose={()=>setEditingPacking(null)} onSave={savePacking} onDelete={(item)=>{setEditingPacking(null);setPackingToDelete(item)}}/>}
      {inviteOpen&&<InviteModal tripId={trip.id} onClose={()=>setInviteOpen(false)}/>}
      {addKind&&<QuickAddModal kind={addKind} categoryOptions={addKind==='expense'?expenseCategories:addKind==='packing'?packingCategories:addKind==='place'?placeCategories:[]} onClose={()=>setAddKind(null)} onSave={addQuick}/>}
      {memberToRemove&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setMemberToRemove(null)}}>
        <div className="modal confirm-modal">
          <h2>Expulsar integrante</h2>
          <p className="muted">Vas a quitar a <b>{memberToRemove.name}</b> de este viaje. Ya no podrá ver ni editar la planificación compartida.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={()=>setMemberToRemove(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmRemoveMember}><UserMinus size={16}/> Expulsar</button>
          </div>
        </div>
      </div>}
      {expenseToDelete&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setExpenseToDelete(null)}}>
        <div className="modal confirm-modal">
          <h2>Eliminar gasto</h2>
          <p className="muted">Vas a eliminar <b>{expenseToDelete.title}</b> del presupuesto. Esta acción no se puede deshacer desde la app.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={()=>setExpenseToDelete(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmDeleteExpense}><Trash2 size={16}/> Eliminar</button>
          </div>
        </div>
      </div>}
      {packingToDelete&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPackingToDelete(null)}}>
        <div className="modal confirm-modal">
          <h2>Eliminar ítem</h2>
          <p className="muted">Vas a eliminar <b>{packingToDelete.label}</b> de tu valija. Esta acción no se puede deshacer desde la app.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={()=>setPackingToDelete(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmDeletePacking}><Trash2 size={16}/> Eliminar</button>
          </div>
        </div>
      </div>}
    </main>
  </div>
}
