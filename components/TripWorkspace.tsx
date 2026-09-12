'use client'
import { useEffect, useMemo, useState } from 'react'
import { AppBar } from './AppBar'
import ConfirmDialog from './ConfirmDialog'
import Snackbar from './Snackbar'
import InviteModal from './InviteModal'
import PackingItemModal from './PackingItemModal'
import PlaceModal from './PlaceModal'
import QuickAddModal from './QuickAddModal'
import TripItemModal, { TripItemTab } from './TripItemModal'
import TripPrintView from './TripPrintView'
import { activities as seedActivities, expenses as seedExpenses, packing as seedPacking, reservations as seedReservations, trips as demoTrips } from '@/lib/demo-data'
import { Activity, Expense, PackingItem, Place, Reservation, Trip, ChangeLogItem, TripItem, TripItemSaveInput } from '@/lib/types'
import { money } from '@/lib/money'
import { createClient } from '@/lib/supabase-client'
import { mapActivity, mapActivityStep, mapExpense, mapPacking, mapPlace, mapReservation, mapTrip, mapTripItem } from '@/lib/db-mappers'
import { logChange } from '@/lib/change-log'
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, DollarSign, Download, Edit3, ExternalLink, History, Link2, ListTree, Luggage, Map as MapIcon, MapPin, Menu, Minus, Navigation, Plus, ReceiptText, Repeat2, Share2, Star, Trash2, UserMinus, Users, Wifi, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { changeActionLabel, tripRoleLabel, userFacingError } from '@/lib/ui-text'
import type { PlaceAutocompleteOption } from './PlaceAutocomplete'
import {
  canonicalItemCategory as itemCategoryLabel,
  expenseGroupTotal,
  expenseOccurrenceMultiplier,
  isTechnicalLegacyCategory,
  itineraryStatus,
  itineraryStatusLabel,
  savedPlaceValue,
  sortReservationsForDisplay,
} from '@/lib/trip-item-rules'
import { tripSectionPath, tripTabs, type TripTab } from '@/lib/trip-navigation'
import { occurrenceEndDate, occurrencesOverlap } from '@/lib/activity-dates'

type AddKind = 'packing'|'place'|null
type SyncStatus = 'demo'|'syncing'|'synced'|'error'
type TripMember = { id:string; name:string; username?:string; role:'owner'|'editor'|'viewer'; joinedAt?:string }
type EditingTripItem = {
  item:TripItem
  initialTab:TripItemTab
  initialFacet?: Exclude<TripItemTab,'general'>
  isNew:boolean
}

function dayLabel(date:string){
  return new Date(date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})
}
function shortDate(date:string){
  return new Date(date+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'})
}
function occurrenceDateLabel(date:string){
  return new Date(date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'})
}
function occurrenceRangeLabel(activity:Pick<Activity,'date'|'endDate'>){
  const endDate=occurrenceEndDate(activity)
  return endDate===activity.date?occurrenceDateLabel(activity.date):`${occurrenceDateLabel(activity.date)} a ${occurrenceDateLabel(endDate)}`
}
function activityStateLabel(status:Activity['status']){
  return itineraryStatusLabel(status)
}
function activityChip(status:Activity['status']){
  return `status-${itineraryStatus(status)}`
}
function activityCategoryLabel(category:Activity['category']){
  return itemCategoryLabel(category)
}

function reservationLabel(status:Reservation['status']){
  return ({watching:'Esperando',pending:'Pendiente',reserved:'Reservado',paid:'Pagado'})[status]
}
function reservationChip(status:Reservation['status']){
  return `reservation-${status}`
}
function expenseStatusLabel(status:Expense['status']){
  return ({estimated:'Estimado',confirmed:'Confirmado',paid:'Pagado'})[status]
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
function safeExternalUrl(value?:string){
  if(!value)return null
  try{
    const url=new URL(value)
    return ['http:','https:'].includes(url.protocol)?url.toString():null
  }catch{return null}
}
function activitiesOverlap(a:Activity,b:Activity){
  return occurrencesOverlap(a,b)
}
function sortActivities(a:Activity,b:Activity){
  const byTime=(a.startTime||'99:99').localeCompare(b.startTime||'99:99')
  if(byTime!==0)return byTime
  const byPosition=(a.position ?? 0)-(b.position ?? 0)
  if(byPosition!==0)return byPosition
  return a.title.localeCompare(b.title)
}
function sortOccurrenceActivities(a:Activity,b:Activity){
  return a.date.localeCompare(b.date) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || a.id.localeCompare(b.id)
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
    endDate:new Date().toISOString().slice(0,10),currency:'ARS',status:'planning',travelerCount:1,memberNames:['Demo'],role:'owner'
  }
}

export default function TripWorkspace({tripId,initialTab}:{tripId:string;initialTab:TripTab}){
  const router=useRouter()
  const [trip,setTrip]=useState<Trip>(demoTripFor(tripId))
  const [tab,setTab]=useState<TripTab>(initialTab)
  const [acts,setActs]=useState<Activity[]>(seedActivities.filter(x=>x.tripId===tripId))
  const [exp,setExp]=useState<Expense[]>(seedExpenses.filter(x=>x.tripId===tripId))
  const [res,setRes]=useState<Reservation[]>(seedReservations.filter(x=>x.tripId===tripId))
  const [items,setItems]=useState<TripItem[]>([])
  const [pack,setPack]=useState<PackingItem[]>(seedPacking.filter(x=>x.tripId===tripId))
  const [places,setPlaces]=useState<Place[]>([])
  const [members,setMembers]=useState<TripMember[]>([])
  const [changes,setChanges]=useState<ChangeLogItem[]>([])
  const [editingPacking,setEditingPacking]=useState<PackingItem|null>(null)
  const [editingItem,setEditingItem]=useState<EditingTripItem|null>(null)
  const [itemToDelete,setItemToDelete]=useState<TripItem|null>(null)
  const [editingPlace,setEditingPlace]=useState<Place|null>(null)
  const [packingToDelete,setPackingToDelete]=useState<PackingItem|null>(null)
  const [placeToDelete,setPlaceToDelete]=useState<Place|null>(null)
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
  const [savingTravelerCount,setSavingTravelerCount]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [successNotificationId,setSuccessNotificationId]=useState(0)

  function showSuccess(message:string){
    setError('')
    setSuccess(message)
    setSuccessNotificationId(current=>current+1)
  }

  const storageKey=`tripmate-demo:${tripId}`

  useEffect(()=>{
    setTab(initialTab)
    setMobileMoreOpen(false)
  },[initialTab])

  function selectTab(nextTab:TripTab){
    setMobileMoreOpen(false)
    if(nextTab===tab)return
    setTab(nextTab)
    router.push(tripSectionPath(tripId,nextTab,window.location.search),{scroll:false})
  }

  useEffect(()=>{
    const message=sessionStorage.getItem('tripmate-success')
    if(!message)return
    sessionStorage.removeItem('tripmate-success')
    setSuccess(message)
    setSuccessNotificationId(current=>current+1)
  },[])

  async function loadConnectedData(silent=false){
    const supabase=createClient()
    if(!supabase)return false
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace(`/login?next=${encodeURIComponent(tripSectionPath(tripId,initialTab))}`);return true}
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

    const [membersQ,itemsQ,actsQ,stepsQ,expQ,resQ,placesQ,packQ,logQ]=await Promise.all([
      supabase.from('trip_members').select('role,user_id,joined_at').eq('trip_id',tripId),
      supabase.from('trip_items').select('*').eq('trip_id',tripId),
      supabase.from('activities').select('*').eq('trip_id',tripId).order('date').order('start_time'),
      supabase.from('activity_steps').select('*').eq('trip_id',tripId).order('position'),
      supabase.from('expenses').select('*').eq('trip_id',tripId).order('created_at'),
      supabase.from('reservations').select('*').eq('trip_id',tripId).order('position').order('created_at'),
      supabase.from('places').select('*').eq('trip_id',tripId).order('is_base',{ascending:false}).order('created_at'),
      supabase.from('packing_items').select('*').eq('trip_id',tripId).eq('assigned_to',user.id).order('position').order('created_at'),
      supabase.from('change_log').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}).limit(8),
    ])

    const members=(membersQ.data||[]) as any[]
    const queryError=[membersQ,itemsQ,actsQ,stepsQ,expQ,resQ,placesQ,packQ,logQ].find(result=>result.error)?.error
    if(queryError){
      setError(userFacingError(queryError,'No pudimos sincronizar todos los datos. Revisá la conexión e intentá nuevamente.'))
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
    const stepsByActivity=new Map<string,ReturnType<typeof mapActivityStep>[]>()
    ;(stepsQ.data || []).forEach(row=>{
      const mapped=mapActivityStep(row)
      stepsByActivity.set(row.activity_id,[...(stepsByActivity.get(row.activity_id) || []),mapped])
    })
    const mappedPlaces=(placesQ.data||[]).map(mapPlace)
    const placeById=new Map(mappedPlaces.map(place=>[place.id,place]))
    const mappedItems=(itemsQ.data||[]).map(mapTripItem).map(item=>{
      const place=item.placeId?placeById.get(item.placeId):undefined
      return place?{...item,place:savedPlaceValue(place)}:item
    })
    const itemById=new Map(mappedItems.map(item=>[item.id,item]))
    const mappedActivities=(actsQ.data||[]).map(row=>{
      const activity={...mapActivity(row),steps:stepsByActivity.get(row.id) || []}
      const item=activity.itemId?itemById.get(activity.itemId):undefined
      return item?{...activity,title:item.title,category:item.category,place:item.place,notes:item.notes,optional:item.optional}:activity
    })
    const mappedExpenses=(expQ.data||[]).map(mapExpense).map(expense=>{
      const item=expense.itemId?itemById.get(expense.itemId):undefined
      const occurrences=mappedActivities
        .filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId)
        .sort((a,b)=>a.date.localeCompare(b.date) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
        .map(activity=>({id:activity.id,date:activity.date,endDate:activity.endDate || activity.date,startTime:activity.startTime,endTime:activity.endTime,steps:activity.steps || []}))
      return {...expense,...(item?{title:item.title,category:item.category,place:item.place,notes:item.notes,optional:item.optional}:{}),activityId:occurrences[0]?.id || expense.activityId,occurrences}
    })
    const mappedReservations=(resQ.data||[]).map(mapReservation).map(reservation=>{
      const item=reservation.itemId?itemById.get(reservation.itemId):undefined
      return item?{...reservation,title:item.title,notes:item.notes}:reservation
    })
    setActs(mappedActivities)
    setExp(mappedExpenses)
    setRes(mappedReservations)
    setItems(mappedItems)
    setPlaces(mappedPlaces)
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
          if(d.trip)setTrip({...d.trip,travelerCount:Math.max(1,Number(d.trip.travelerCount || d.trip.memberNames?.length || 1))})
          if(d.acts)setActs(d.acts)
          if(d.exp)setExp(d.exp)
          if(d.res)setRes(d.res)
          if(d.items)setItems(d.items)
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
    localStorage.setItem(storageKey,JSON.stringify({trip,acts,exp,res,items,places,pack}))
  },[trip,acts,exp,res,items,places,pack,hydrated,connected,storageKey])

  useEffect(()=>{
    if(!connected)return
    const supabase=createClient()
    if(!supabase)return
    let timer:ReturnType<typeof setTimeout>|undefined
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>loadConnectedData(true),180)}
    const channel=supabase.channel(`trip-${tripId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'activities',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'trip_items',filter:`trip_id=eq.${tripId}`},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'activity_steps',filter:`trip_id=eq.${tripId}`},refresh)
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

  const activitiesForExpense=(expense:Expense)=>acts.filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId)
  const isExpenseLinked=(expense:Expense)=>activitiesForExpense(expense).length>0
  const isExpenseIncluded=(expense:Expense)=>expense.included!==false
  const travellers=Math.max(1,trip.travelerCount || 1)
  const expenseMultiplier=(expense:Expense)=>expenseOccurrenceMultiplier(expense,activitiesForExpense(expense).length)
  const expenseGroupAmount=(expense:Expense)=>expenseGroupTotal(expense,travellers,activitiesForExpense(expense).length)
  const groupBudget=exp.filter(isExpenseIncluded).reduce((sum,expense)=>sum+expenseGroupAmount(expense),0)
  const perPersonBudget=groupBudget/travellers
  const fixedBudget=perPersonBudget
  const visibleActivities=acts
  const pendingReservations=res.filter(r=>r.status==='pending'||r.status==='watching').length
  const packedCount=pack.filter(p=>p.packed).length
  const pctPacked=pack.length?Math.round((packedCount/pack.length)*100):0
  const dates:string[]=[...new Set<string>(visibleActivities.map(a=>a.date))].sort()
  const canEdit=trip.role==='owner'||trip.role==='editor'
  const canManagePacking=Boolean(trip.role)
  const isOwner=trip.role==='owner'
  const basePlace=places.find(p=>p.isBase) || places.find(p=>/aloj|hotel|hostel|depart|base/i.test(`${p.category} ${p.name}`))
  const alternativesFor=(activity:Activity)=>visibleActivities
    .filter(candidate=>candidate.id!==activity.id && candidate.date===activity.date && (candidate.optional || candidate.status==='idea') && activitiesOverlap(activity,candidate))
    .sort(sortActivities)

  const groupedExpenses=useMemo<[string,number][]>(()=>{
    const m=new Map<string,number>()
    exp.filter(isExpenseIncluded).forEach(e=>{
      const category=itemCategoryLabel(e.category)
      m.set(category,(m.get(category)||0)+(expenseGroupAmount(e)/travellers))
    })
    return [...m.entries()].sort((a,b)=>b[1]-a[1])
  },[exp,travellers,acts])
  const itemCategories=useMemo(()=>uniqueCategories(
    ['Actividad','Paseo','Museo','Evento','Transporte','Comida','Alojamiento','Noche','Compras','Contingencia'],
    items.filter(item=>!isTechnicalLegacyCategory(item.category)).map(item=>itemCategoryLabel(item.category)),
  ),[items])
  const itemPlaceSuggestions=useMemo<PlaceAutocompleteOption[]>(()=>places.map(place=>({
    id:place.id,name:place.name,address:place.address,latitude:place.latitude,longitude:place.longitude,
  })),[places])
  const packingCategories=useMemo(()=>uniqueCategories(pack.map(p=>p.category),['Ropa','Documentos','Tecnología','Cuidado','Organización','General']),[pack])
  const placeCategories=useMemo(()=>uniqueCategories(
    ['Alojamiento','Comida','Paseo','Transporte','Noche','Compras'],
    places.map(place=>itemCategoryLabel(place.category)),
  ),[places])
  const maxExpense=Math.max(...groupedExpenses.map(x=>x[1]),1)
  const expenseByActivityId=useMemo(()=>{
    const result=new Map<string,Expense>()
    acts.forEach(activity=>{
      const expense=exp.find(item=>activity.expenseId===item.id || item.activityId===activity.id)
      if(expense)result.set(activity.id,expense)
    })
    return result
  },[exp,acts])
  const expenseById=useMemo(()=>new Map(exp.map(expense=>[expense.id,expense])),[exp])
  const reservationByItemId=useMemo(()=>new Map(res.filter(reservation=>reservation.itemId).map(reservation=>[reservation.itemId!,reservation])),[res])
  const milestoneActivities=useMemo(()=>visibleActivities.filter(activity=>
    Boolean(activity.itemId&&reservationByItemId.get(activity.itemId)) ||
    ['Evento','Alojamiento'].includes(itemCategoryLabel(activity.category))
  ).slice(0,6),[visibleActivities,reservationByItemId])
  const recurrenceCountFor=(activity:Activity)=>expenseByActivityId.get(activity.id)?.occurrences?.length || 0
  const recurrenceLabelFor=(activity:Activity)=>{
    const occurrences=expenseByActivityId.get(activity.id)?.occurrences || []
    const count=occurrences.length
    if(count<2)return ''
    const distinctDates=new Set(occurrences.map(item=>item.date)).size
    return distinctDates===count?`${count} días`:`${count} apariciones`
  }
  const sortedExpenses=useMemo(()=>[...exp].sort((a,b)=>{
    const aActivity=activitiesForExpense(a).sort(sortOccurrenceActivities)[0]
    const bActivity=activitiesForExpense(b).sort(sortOccurrenceActivities)[0]
    const aDate=a.date || aActivity?.date || '9999-12-31'
    const bDate=b.date || bActivity?.date || '9999-12-31'
    if(aDate!==bDate)return aDate.localeCompare(bDate)
    const aTime=a.startTime || aActivity?.startTime || '99:99'
    const bTime=b.startTime || bActivity?.startTime || '99:99'
    if(aTime!==bTime)return aTime.localeCompare(bTime)
    return a.title.localeCompare(b.title)
  }),[exp,acts])
  const visibleExpenses=useMemo(()=>expenseCategoryFilter?sortedExpenses.filter(expense=>itemCategoryLabel(expense.category)===expenseCategoryFilter):sortedExpenses,[sortedExpenses,expenseCategoryFilter])
  const expensesByDay=useMemo(()=>{
    const groups=new Map<string,Expense[]>()
    visibleExpenses.forEach(expense=>{
      const linkedActivities=activitiesForExpense(expense).sort(sortOccurrenceActivities)
      const key=linkedActivities.length>1?'varios-dias':expense.date || linkedActivities[0]?.date || 'sin-fecha'
      groups.set(key,[...(groups.get(key)||[]),expense])
    })
    return [...groups.entries()].sort(([a],[b])=>{
      const rank=(value:string)=>value==='varios-dias'?'0000-00-00':value==='sin-fecha'?'9999-12-31':value
      return rank(a).localeCompare(rank(b))
    })
  },[visibleExpenses,acts])

  function openNewItem(initialFacet:Exclude<TripItemTab,'general'>){
    const id=`item-new-${Date.now()}`
    setEditingItem({
      isNew:true,
      initialTab:'general',
      initialFacet,
      item:{id,tripId:trip.id,title:'',category:'',optional:false,originType:'item',originId:id,updatedAt:''},
    })
  }

  function openItemForFacet(initialTab:TripItemTab,facet:Activity|Expense|Reservation){
    const itemId=facet.itemId
    const existing=itemId?items.find(item=>item.id===itemId):undefined
    const category='category' in facet?facet.category:'Reserva'
    setEditingItem({
      isNew:false,
      initialTab,
      item:existing?{...existing,category:itemCategoryLabel(existing.category) || 'Actividad'}:{
        id:itemId || facet.id,tripId:trip.id,title:facet.title,category:itemCategoryLabel(category) || 'Actividad',
        place:'place' in facet?facet.place:undefined,notes:facet.notes,optional:'optional' in facet?Boolean(facet.optional):false,
        originType:'activity',originId:facet.id,updatedAt:facet.updatedAt || '',
      },
    })
  }

  async function saveTripItem(input:TripItemSaveInput){
    if(!canEdit || !editingItem)return
    const {item:inputItem,activities,expense,reservation}=input
    const item={...inputItem,category:itemCategoryLabel(inputItem.category)}
    const supabase=createClient()
    if(!supabase){
      const itemId=editingItem.isNew?`item-${Date.now()}`:item.id
      const savedItem={...item,id:itemId,originId:editingItem.isNew?itemId:item.originId,updatedAt:new Date().toISOString()}
      const savedActivities=activities.map((occurrence,index):Activity=>({
        id:occurrence.id || `a-${Date.now()}-${index}`,tripId:trip.id,itemId,date:occurrence.date,
        endDate:occurrence.endDate || occurrence.date,startTime:occurrence.startTime,endTime:occurrence.endTime,title:item.title,category:item.category,
        place:item.place,notes:item.notes,estimatedCost:expense?.amount || 0,actualCost:expense?.status==='paid'?expense.amount:null,
        costScope:expense?.amountBasis==='group'?'shared':'per_person',status:occurrence.status || 'planned',
        optional:item.optional,position:index,steps:occurrence.steps || [],
      }))
      const savedExpense=expense?{...expense,id:expense.id || `e-${Date.now()}`,tripId:trip.id,itemId,activityId:savedActivities[0]?.id || null,title:item.title,category:item.category,occurrences:activities}:null
      const savedReservation=reservation?{...reservation,id:reservation.id || `r-${Date.now()}`,tripId:trip.id,itemId,expenseId:savedExpense?.id || null,title:item.title,notes:item.notes}:null
      setItems(current=>[...current.filter(candidate=>candidate.id!==item.id),savedItem])
      setActs(current=>[...current.filter(activity=>activity.itemId!==item.id),...savedActivities])
      setExp(current=>[...current.filter(candidate=>candidate.itemId!==item.id),...(savedExpense?[savedExpense]:[])])
      setRes(current=>[...current.filter(candidate=>candidate.itemId!==item.id),...(savedReservation?[savedReservation]:[])])
      setEditingItem(null)
      showSuccess(editingItem.isNew?'Detalle creado.':'Cambios guardados.')
      return
    }
    const {data,error}=await supabase.rpc('save_trip_item_v3',{
      p_item_id:editingItem.isNew?null:item.id,
      p_trip_id:trip.id,
      p_expected_updated_at:editingItem.isNew?null:item.updatedAt,
      p_title:item.title,
      p_category:item.category,
      p_place:item.place || null,
      p_place_id:item.placeId || null,
      p_notes:item.notes || null,
      p_optional:item.optional,
      p_activities:activities.map(activity=>({
        id:activity.id || null,date:activity.date,end_date:activity.endDate || activity.date,start_time:activity.startTime || null,
        end_time:activity.endTime || null,status:activity.status || 'planned',
        steps:(activity.steps || []).map(step=>({id:step.id || null,title:step.title,amount:step.amount,
          start_time:step.startTime || null,end_time:step.endTime || null,place:step.place || null,
          notes:step.notes || null,optional:Boolean(step.optional)})),
      })),
      p_expense:expense?{id:expense.id || null,amount:expense.amount,status:expense.status,
        amount_basis:expense.amountBasis || 'per_person',occurrence_pricing:expense.occurrencePricing || 'total',
        included:expense.included!==false}:null,
      p_reservation:reservation?{id:reservation.id || null,status:reservation.status,priority:reservation.priority,
        due_date:reservation.dueDate || null,legacy_amount:reservation.amount ?? null}:null,
    })
    if(error){
      if(String(error.message || '').toLowerCase().includes('cambió mientras'))await loadConnectedData(true)
      throw new Error(userFacingError(error,'No pudimos guardar el elemento. Intentá nuevamente.'))
    }
    setEditingItem(null)
    await logChange(trip.id,'trip_item',data,editingItem.isNew?'created':'updated',`${editingItem.isNew?'Se agregó':'Se actualizó'} “${item.title}”.`)
    await loadConnectedData(true)
    showSuccess(editingItem.isNew?'Detalle creado.':'Cambios guardados.')
  }

  async function confirmDeleteItem(){
    const item=itemToDelete
    if(!item || !canEdit)return
    const supabase=createClient()
    if(!supabase){
      setItems(current=>current.filter(candidate=>candidate.id!==item.id))
      setActs(current=>current.filter(activity=>activity.itemId!==item.id))
      setExp(current=>current.filter(expense=>expense.itemId!==item.id))
      setRes(current=>current.filter(reservation=>reservation.itemId!==item.id))
      setItemToDelete(null);setEditingItem(null);showSuccess('Detalle eliminado.');return
    }
    const {error}=await supabase.rpc('delete_trip_item_v1',{p_item_id:item.id,p_trip_id:trip.id,p_expected_updated_at:item.updatedAt})
    if(error){setError(userFacingError(error,'No pudimos eliminar el elemento. Intentá nuevamente.'));await loadConnectedData(true);return}
    setItemToDelete(null);setEditingItem(null)
    await logChange(trip.id,'trip_item',item.id,'deleted',`Se eliminó “${item.title}” y toda su información vinculada.`)
    await loadConnectedData(true)
    showSuccess('Detalle eliminado.')
  }

  async function persistExpense(id:string,amountOverride?:number){
    const current=exp.find(e=>e.id===id)
    const supabase=createClient()
    if(!current)return
    const next={...current,amount:amountOverride ?? current.amount}
    if(!Number.isFinite(next.amount) || next.amount<0){setError('El importe debe ser cero o mayor.');return}
    setExp(items=>items.map(expense=>expense.id===id?next:expense))
    if(!supabase)return
    const {error}=await supabase.rpc('update_expense_amount',{p_expense_id:id,p_trip_id:trip.id,p_amount:next.amount})
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    await logChange(trip.id,'expense',id,'updated',`Se actualizó “${next.title}” a ${money(next.amount,trip.currency)}.`)
    await loadConnectedData(true)
    showSuccess('Importe guardado.')
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

  async function toggleExpenseIncluded(id:string){
    const current=exp.find(e=>e.id===id);if(!current)return
    const included=current.included===false
    setExp(c=>c.map(e=>e.id===id?{...e,included}:e))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('expenses').update({included}).eq('id',id)
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    await logChange(trip.id,'expense',id,'updated',`${included?'Se incluyó':'Se excluyó'} “${current.title}” del presupuesto.`)
  }

  async function togglePacking(id:string){
    const current=pack.find(p=>p.id===id);if(!current)return
    const next=!current.packed
    setPack(c=>c.map(p=>p.id===id?{...p,packed:next}:p))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('packing_items').update({packed:next}).eq('id',id)
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
  }

  async function savePacking(item:PackingItem){
    if(!canManagePacking)return
    const next={...item,label:item.label.trim(),category:item.category.trim() || 'General'}
    const supabase=createClient()
    if(!supabase){
      setPack(current=>current.map(p=>p.id===next.id?next:p))
      setEditingPacking(null)
      showSuccess('Ítem guardado.')
      return
    }
    const {error}=await supabase.from('packing_items').update({label:next.label,category:next.category}).eq('id',next.id)
    if(error)throw new Error(userFacingError(error,'No pudimos guardar el ítem. Intentá nuevamente.'))
    setPack(current=>current.map(p=>p.id===next.id?next:p))
    setEditingPacking(null)
    showSuccess('Ítem guardado.')
  }

  async function confirmDeletePacking(){
    const item=packingToDelete
    if(!item || !canManagePacking)return
    const supabase=createClient()
    if(!supabase){setPack(current=>current.filter(p=>p.id!==item.id));setPackingToDelete(null);setEditingPacking(null);showSuccess('Ítem eliminado.');return}
    const {error}=await supabase.from('packing_items').delete().eq('id',item.id)
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    setPackingToDelete(null)
    setEditingPacking(null)
    setPack(current=>current.filter(p=>p.id!==item.id))
    showSuccess('Ítem eliminado.')
  }

  async function setReservationStatus(id:string,status:Reservation['status']){
    const current=res.find(r=>r.id===id);if(!current)return
    if(status===current.status)return
    setRes(c=>c.map(r=>r.id===id?{...r,status}:r))
    const supabase=createClient();if(!supabase)return
    const {error}=await supabase.from('reservations').update({status}).eq('id',id).eq('trip_id',trip.id)
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    await logChange(trip.id,'reservation',id,'updated',`“${current.title}” pasó a ${reservationLabel(status)}.`)
  }

  async function savePlace(place:Place){
    if(!canEdit)return
    const next={...place,name:place.name.trim(),category:place.category.trim(),address:place.address?.trim() || undefined,url:place.url?.trim() || undefined,notes:place.notes?.trim() || undefined}
    if(!next.name)throw new Error('El nombre no puede estar vacío.')
    if(!next.category)throw new Error('La categoría no puede estar vacía.')
    if(next.url && !safeExternalUrl(next.url))throw new Error('El enlace debe comenzar con http:// o https://.')
    const supabase=createClient()
    if(!supabase){
      setPlaces(current=>current.map(item=>item.id===next.id?next:item))
      setEditingPlace(null)
      showSuccess('Lugar guardado.')
      return
    }
    const {error}=await supabase.from('places').update({
      name:next.name,category:next.category,address:next.address || null,url:next.url || null,
      latitude:next.latitude ?? null,longitude:next.longitude ?? null,notes:next.notes || null,status:next.status,
    }).eq('id',next.id).eq('trip_id',trip.id)
    if(error)throw new Error(userFacingError(error,'No pudimos guardar el lugar. Intentá nuevamente.'))
    setEditingPlace(null)
    await logChange(trip.id,'place',next.id,'updated',`Se actualizó el lugar “${next.name}”.`)
    await loadConnectedData(true)
    showSuccess('Lugar guardado.')
  }

  async function confirmDeletePlace(){
    const place=placeToDelete
    if(!place || !canEdit)return
    const supabase=createClient()
    if(!supabase){
      setPlaces(current=>current.filter(item=>item.id!==place.id))
      setPlaceToDelete(null)
      setEditingPlace(null)
      showSuccess('Lugar eliminado.')
      return
    }
    const {error}=await supabase.from('places').delete().eq('id',place.id).eq('trip_id',trip.id)
    if(error){setError(userFacingError(error,'No pudimos eliminar el lugar. Intentá nuevamente.'));return}
    setPlaceToDelete(null)
    setEditingPlace(null)
    await logChange(trip.id,'place',place.id,'deleted',`Se eliminó el lugar “${place.name}”.`)
    await loadConnectedData(true)
    showSuccess('Lugar eliminado.')
  }

  async function addQuick(payload:any){
    const supabase=createClient()
    if(addKind==='packing'){
      const item:PackingItem={id:`p-${Date.now()}`,tripId:trip.id,assignedToId:currentUserId,label:payload.title,assignedTo:'Personal',packed:false,category:payload.category||'General'}
      if(!supabase){setPack(c=>[...c,item]);showSuccess('Ítem guardado.');return}
      const {data:{user}}=await supabase.auth.getUser()
      const {data,error}=await supabase.from('packing_items').insert({trip_id:trip.id,label:item.label,assigned_to:user?.id||null,assigned_label:null,packed:false,category:item.category,created_by:user?.id||null}).select('*').single()
      if(error)throw error
      setPack(c=>[...c,mapPacking(data)])
    }
    if(addKind==='place'){
      const item:Place={id:`pl-${Date.now()}`,tripId:trip.id,name:payload.title,category:payload.category||'General',address:payload.address||undefined,latitude:payload.latitude??null,longitude:payload.longitude??null,url:payload.url||undefined,notes:payload.notes||undefined,status:'saved',isBase:false}
      if(!supabase){setPlaces(c=>[...c,item]);showSuccess('Lugar guardado.');return}
      const {data,error}=await supabase.from('places').insert({trip_id:trip.id,name:item.name,category:item.category,address:item.address||null,latitude:item.latitude??null,longitude:item.longitude??null,url:item.url||null,notes:item.notes||null,status:'saved',is_base:false}).select('*').single()
      if(error)throw error
      setPlaces(c=>[...c,mapPlace(data)])
      await logChange(trip.id,'place',data.id,'created',`Se agregó el lugar “${item.name}”.`)
    }
    showSuccess(({packing:'Ítem guardado.',place:'Lugar guardado.'} as const)[addKind!])
  }

  async function setBasePlace(place:Place){
    if(!canEdit)return
    const supabase=createClient()
    if(!supabase){setPlaces(current=>current.map(p=>({...p,isBase:p.id===place.id})));showSuccess('Base del viaje guardada.');return}
    const {error}=await supabase.rpc('set_trip_base_place',{p_place_id:place.id,p_trip_id:trip.id})
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    await logChange(trip.id,'place',place.id,'updated',`Se marcó “${place.name}” como base del viaje.`)
    await loadConnectedData(true)
    showSuccess('Base del viaje guardada.')
  }

  async function confirmRemoveMember(){
    const member=memberToRemove
    if(!member || trip.role!=='owner' || member.role==='owner')return
    const supabase=createClient()
    if(!supabase){setMemberToRemove(null);showSuccess('Integrante eliminado.');return}
    const {error}=await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id',trip.id)
      .eq('user_id',member.id)
    if(error){setError(userFacingError(error));return}
    setMemberToRemove(null)
    await logChange(trip.id,'member',null,'removed',`Se expulsó a ${member.name} del viaje.`)
    await loadConnectedData(true)
    showSuccess('Integrante eliminado.')
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
    if(error){setError(userFacingError(error));await loadConnectedData(true);return}
    await logChange(trip.id,'member',null,'updated',`${member.name} ahora tiene rol ${tripRoleLabel(role)}.`)
    showSuccess('Rol guardado.')
  }

  async function updateTravelerCount(nextCount:number){
    if(trip.role!=='owner' || savingTravelerCount)return
    const next=Math.min(100,Math.max(1,nextCount))
    if(next===trip.travelerCount)return
    const previous=trip.travelerCount
    setTrip(current=>({...current,travelerCount:next}))
    const supabase=createClient()
    if(!supabase)return
    setSavingTravelerCount(true)
    setSyncStatus('syncing')
    const {error}=await supabase.from('trips').update({traveler_count:next}).eq('id',trip.id).select('traveler_count').single()
    if(error){
      setTrip(current=>({...current,travelerCount:previous}))
      setError(userFacingError(error,'No pudimos actualizar la cantidad de viajeros.'))
      setSyncStatus('error')
      setSavingTravelerCount(false)
      return
    }
    setSyncStatus('synced')
    setSavingTravelerCount(false)
    await logChange(trip.id,'trip',trip.id,'updated',`Se actualizó la cantidad de viajeros a ${next}.`)
    showSuccess('Cantidad de viajeros guardada.')
  }

  if(loading)return <div className="shell"><AppBar/><main className="container workspace-skeleton" aria-busy="true" aria-label="Cargando viaje"><div className="skeleton-block skeleton-hero"/><div className="skeleton-block skeleton-tabs"/><div className="two-col"><div className="panel">{[0,1,2,3].map(item=><div className="skeleton-row" key={item}><div className="skeleton-line wide"/><div className="skeleton-line"/></div>)}</div><div className="panel"><div className="skeleton-line wide"/><div className="skeleton-block skeleton-summary"/></div></div></main></div>

  return <div className="shell">
    <AppBar/>
    <main className="container">
      <Snackbar message={error} tone="error" onClose={()=>setError('')}/>
      <Snackbar message={success} tone="success" onClose={()=>setSuccess('')} notificationId={successNotificationId}/>
      <section className="hero">
        <div className="hero-head">
          <div>
            <div className="eyebrow">Viaje compartido · {travellers} {travellers===1?'viajero':'viajeros'}</div>
            <h1>{trip.name}</h1>
            <p><MapPin size={14} style={{verticalAlign:'-2px'}}/> {trip.destination} · {shortDate(trip.startDate)} — {shortDate(trip.endDate)}</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-secondary trip-print-button" onClick={()=>window.print()} title="Guardar el plan como PDF" aria-label="Guardar el plan como PDF"><Download size={16}/><span>Guardar PDF</span></button>
            {isOwner&&<button className="btn btn-secondary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
            <div className={`sync-badge ${syncStatus==='synced'?'online':'demo'}`} title={syncStatus==='error'?'No se pudieron sincronizar todos los cambios':undefined}>{syncStatus==='synced'?<><Wifi size={13}/> Sincronizado</>:syncStatus==='syncing'?<><Wifi size={13}/> Sincronizando…</>:syncStatus==='error'?<><WifiOff size={13}/> Sin conexión</>:<><WifiOff size={13}/> Demo</>}</div>
            <div style={{display:'flex',marginLeft:2}}>{trip.memberNames.map((n,i)=><div key={`${n}-${i}`} className="avatar" title={n} style={{marginLeft:i?-8:0,border:'2px solid rgba(255,255,255,.6)',background:i?'#f1d9e8':'#dfe8ff'}}>{n[0]}</div>)}</div>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><span>Estimado</span><b>{money(perPersonBudget,trip.currency)}</b></div>
          <div className="stat"><span>Total grupo</span><b>{money(groupBudget,trip.currency)}</b></div>
          <div className="stat"><span>Reservas pendientes</span><b>{pendingReservations}</b></div>
          <div className="stat"><span>Valija lista</span><b>{pctPacked}%</b></div>
        </div>
      </section>

      <nav className="tabs" aria-label="Secciones del viaje">
        {tripTabs.map(t=><button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>selectTab(t)}>{t}</button>)}
      </nav>

      {tab==='Resumen' && <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Próximos hitos</h3><div className="muted subcopy">Lo importante del viaje, sin leer todo el itinerario.</div></div><button className="btn btn-ghost" onClick={()=>selectTab('Itinerario')}>Ver todo</button></div>
          <div className="list">
            {milestoneActivities.map(a=><div className="list-row" key={a.id}>
              <div><strong>{a.title}</strong><small>{occurrenceEndDate(a)===a.date?shortDate(a.date):`${shortDate(a.date)} a ${shortDate(occurrenceEndDate(a))}`} {a.startTime?`· ${a.startTime}`:''} {a.place?`· ${a.place}`:''}</small></div>
              {a.itemId&&reservationByItemId.get(a.itemId)?<span className={`chip ${reservationChip(reservationByItemId.get(a.itemId)!.status)}`}>Reserva: {reservationLabel(reservationByItemId.get(a.itemId)!.status)}</span>:<span className={`chip ${activityChip(a.status)}`}>Agenda: {activityStateLabel(a.status)}</span>}
            </div>)}
            {!milestoneActivities.length&&<div className="empty compact">Todavía no hay reservas, eventos ni alojamientos programados.</div>}
          </div>
        </section>
        <aside style={{display:'grid',gap:18}}>
          <section className="panel">
            <div className="panel-head"><h3>Presupuesto</h3><ReceiptText size={18} className="muted"/></div>
            <div className="summary-money">{money(perPersonBudget,trip.currency)}</div><div className="money-sub">{money(groupBudget,trip.currency)} total grupo</div>
            {groupedExpenses.slice(0,4).map(([cat,amount])=><div className="bar-row" key={cat}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></div>)}
          </section>
          {isOwner&&<section className="panel">
            <div className="panel-head"><h3>Actividad reciente</h3><History size={18} className="muted"/></div>
            {connected&&changes.length?<div className="list">{changes.slice(0,5).map(c=><div className="change-row" key={c.id}><span className="change-dot"/><div><strong>{c.summary || changeActionLabel(c.action)}</strong><small>{new Date(c.createdAt).toLocaleString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div></div>)}</div>:<div className="muted" style={{fontSize:13}}>Cuando usen Supabase, acá verán qué cambió el grupo.</div>}
          </section>}
        </aside>
      </div>}

      {tab==='Itinerario' && <section className="panel">
        <div className="panel-head"><div><h3>Itinerario</h3><div className="muted subcopy">Organizá los días del viaje. El costo es opcional.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>openNewItem('itinerary')}><Plus size={16}/> Actividad</button>}</div>
        {dates.map(date=><div className="timeline-day" key={date}>
          <div className="day-heading"><strong style={{textTransform:'capitalize'}}>{dayLabel(date)}</strong><span>{visibleActivities.filter(a=>a.date===date).length} actividades</span></div>
          {visibleActivities.filter(a=>a.date===date).sort(sortActivities).map((a,index,dayActs)=><div key={a.id} className="activity" style={{width:'100%',background:'transparent',borderLeft:0,borderRight:0,borderBottom:0,textAlign:'left',color:'inherit'}}>
            <div className="activity-time">
              <span className="time-start">{a.startTime||'—'}</span>
              {a.endTime&&<><span className="time-to">a</span><span className="time-end">{a.endTime}</span></>}
            </div>
            <div><div className="activity-title">{a.title} {a.optional?<span className="chip optional">Opcional</span>:null}</div><div className="activity-sub">{[occurrenceEndDate(a)!==a.date?`Finaliza ${occurrenceDateLabel(occurrenceEndDate(a))}`:'',a.place,a.notes].filter(Boolean).join(' · ')}</div><div className="chips"><span className={`chip ${activityChip(a.status)}`}>Agenda: {activityStateLabel(a.status)}</span>{a.itemId&&reservationByItemId.get(a.itemId)&&<span className={`chip ${reservationChip(reservationByItemId.get(a.itemId)!.status)}`}>Reserva: {reservationLabel(reservationByItemId.get(a.itemId)!.status)}</span>}{expenseByActivityId.get(a.id)&&<span className={`chip status-${expenseByActivityId.get(a.id)!.status}`}>Costo: {expenseStatusLabel(expenseByActivityId.get(a.id)!.status)}</span>}{a.status==='reserved'&&!(a.itemId&&reservationByItemId.get(a.itemId))&&<span className="chip">Reserva anterior: Reservado</span>}{a.status==='paid'&&!expenseByActivityId.get(a.id)&&<span className="chip">Costo anterior: Pagado</span>}<span className="chip category-chip">{activityCategoryLabel(a.category)}</span>{recurrenceCountFor(a)>1&&<span className="chip recurrence-chip" title={`Esta actividad tiene ${recurrenceCountFor(a)} apariciones en el itinerario`}><Repeat2 size={12}/>{recurrenceLabelFor(a)}</span>}{Boolean(a.steps?.length)&&<span className="chip category-chip">{a.steps!.length} {a.steps!.length===1?'parada':'paradas'}</span>}</div>
              {Boolean(a.steps?.length)&&<div className="activity-steps" aria-label={`Paradas de ${a.title}`}>
                {a.steps!.map((step,stepIndex)=><div className="activity-step" key={step.id || `${a.id}-step-${stepIndex}`}>
                  <div className="activity-step-time">{step.startTime || 'Sin hora'}{step.endTime?` a ${step.endTime}`:''}</div>
                  <div className="activity-step-content"><strong>{step.title}</strong>{step.optional&&<span className="chip optional">Opcional</span>}{(step.place||step.notes)&&<small>{[step.place,step.notes].filter(Boolean).join(' · ')}</small>}</div>
                  {step.amount>0&&<div className="activity-step-price">{money(step.amount,trip.currency)}</div>}
                </div>)}
                {a.steps!.some(step=>step.amount>0)&&<div className="activity-steps-total"><span>Referencia de paradas (no suma al presupuesto)</span><strong>{money(a.steps!.reduce((sum,step)=>sum+step.amount,0),trip.currency)}</strong></div>}
              </div>}
              {a.optional&&alternativesFor(a).length>0&&<div className="alternatives-box">
                <span>Alternativas para este horario</span>
                <div>{alternativesFor(a).slice(0,3).map(alt=><span className="alternative-pill" key={alt.id}>{alt.startTime||'Sin hora'} · {alt.title}</span>)}</div>
              </div>}
            </div>
            <div className="activity-side">{(Boolean(expenseByActivityId.get(a.id))||(a.actualCost ?? a.estimatedCost)>0)&&<div className="price">{money(a.actualCost ?? a.estimatedCost,trip.currency)}{expenseByActivityId.get(a.id)&&<small>{[recurrenceCountFor(a)>1?(expenseByActivityId.get(a.id)?.occurrencePricing==='per_occurrence'?'cada aparición':'total'):'',expenseByActivityId.get(a.id)?.amountBasis==='group'?'grupo':''].filter(Boolean).join(' · ')}</small>}</div>}{canEdit&&<button className="icon-btn" title={`Editar ${a.title}`} aria-label={`Editar ${a.title}`} onClick={()=>openItemForFacet('itinerary',a)}><Edit3 size={16}/></button>}</div>
          </div>)}
        </div>)}
        {!dates.length&&<div className="empty"><h3>Itinerario vacío</h3><p>Agregá la primera actividad para empezar a organizar el viaje.</p>{canEdit&&<button className="btn btn-primary" onClick={()=>openNewItem('itinerary')}>Agregar actividad</button>}</div>}
      </section>}

      {tab==='Presupuesto' && <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Presupuesto editable</h3><div className="muted subcopy">Los precios grupales se identifican de forma explícita.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>openNewItem('cost')}><Plus size={16}/> Gasto</button>}</div>
          {expenseCategoryFilter&&<div className="filter-notice">Mostrando gastos de <b>{expenseCategoryFilter}</b><button onClick={()=>setExpenseCategoryFilter(null)}>Ver todos</button></div>}
          <div className="budget-days">{expensesByDay.map(([date,items])=><div className="budget-day" key={date}>
            <div className="day-heading budget-day-heading"><strong>{date==='varios-dias'?'Varias apariciones':date==='sin-fecha'?'Sin día en itinerario':dayLabel(date)}</strong><span>{items.length} {items.length===1?'gasto':'gastos'}</span></div>
            <div className="list">{items.map(e=>{
              const status=expenseStatusLabel(e.status)
              const linked=isExpenseLinked(e)
              const included=isExpenseIncluded(e)
              const linkedActivities=activitiesForExpense(e).sort(sortOccurrenceActivities)
              const linkedReservation=res.find(reservation=>reservation.expenseId===e.id)
              const activity=linkedActivities[0]
              const stepCount=linkedActivities.reduce((total,item)=>total+(item.steps?.length??0),0)
              const hasSteps=stepCount>0
              const occurrenceLabel=linkedActivities.length>1?`${linkedActivities.length} apariciones · ${e.occurrencePricing==='per_occurrence'?'importe por aparición':'importe total'}`:''
              const occurrenceDates=linkedActivities.length>1 || (linkedActivities.length===1 && occurrenceEndDate(linkedActivities[0])!==linkedActivities[0].date)?linkedActivities.map(occurrenceRangeLabel).join(', '):''
              return <div className={`list-row budget-line ${!included?'excluded':''}`} key={e.id} style={{alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className={`budget-check ${included?'on':''}`} disabled={!canEdit} onClick={()=>toggleExpenseIncluded(e.id)} aria-label={`${included?'Excluir':'Incluir'} ${e.title}`} aria-pressed={included}>{included?'✓':''}</button><div><div className="budget-title-row"><strong>{e.title}</strong>{linkedReservation&&<span className="budget-structure-badge" title="Este gasto está vinculado a una reserva"><ClipboardCheck size={13}/>Reserva: {reservationLabel(linkedReservation.status)}</span>}{hasSteps&&<span className="budget-structure-badge" title="Esta actividad incluye paradas"><ListTree size={13}/>{stepCount} {stepCount===1?'parada':'paradas'}</span>}</div><small>{[occurrenceDates,linkedActivities.length===1?activity?.startTime:'',e.place||activity?.place,itemCategoryLabel(e.category),e.amountBasis==='group'?'total grupo':'',occurrenceLabel,status,!linked?'sin día en itinerario':!included?'fuera del total':''].filter(Boolean).join(' · ')}</small></div></div>
                <div className="budget-actions"><div className="money-input"><span>{trip.currency}</span><input aria-label={`Costo ${e.title}`} disabled={!canEdit} min="0" step="0.01" type="number" value={expenseAmountDrafts[e.id] ?? String(e.amount)} onChange={ev=>setExpenseAmountDrafts(current=>({...current,[e.id]:ev.target.value}))} onBlur={()=>commitExpenseAmount(e)}/></div>{canEdit&&<>{linkedReservation&&<button className="icon-btn" title={`Editar reserva ${linkedReservation.title}`} aria-label={`Editar la reserva vinculada a ${e.title}`} onClick={()=>openItemForFacet('reservation',linkedReservation)}><ClipboardCheck size={16}/></button>}<button className="icon-btn" title={`Editar ${e.title}`} aria-label={`Editar ${e.title}`} onClick={()=>openItemForFacet('cost',e)}><Edit3 size={16}/></button></>}</div>
              </div>
            })}</div>
          </div>)}</div>
        </section>
        <aside className="panel">
          <h3>Estimado</h3><div className="summary-money">{money(fixedBudget,trip.currency)}</div><div className="money-sub">{money(fixedBudget*travellers,trip.currency)} total grupo · {travellers} viajeros</div>
          <div className="budget-buffer"><b>+15% recomendado:</b><br/>{money(fixedBudget*1.15,trip.currency)} para absorber cambios e imprevistos.</div>
          {groupedExpenses.map(([cat,amount])=><button className={`bar-row bar-filter ${expenseCategoryFilter===cat?'active':''}`} key={cat} onClick={()=>setExpenseCategoryFilter(current=>current===cat?null:cat)}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></button>)}
        </aside>
      </div>}

      {tab==='Reservas' && <section className="panel">
        <div className="panel-head"><div><h3>Reservas y compras</h3><div className="muted subcopy">Pendientes, confirmadas y pagadas.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>openNewItem('reservation')}><Plus size={16}/> Reserva</button>}</div>
        <div className="list">{[...res].sort(sortReservationsForDisplay).map(r=>{
          const linkedExpense=r.expenseId?expenseById.get(r.expenseId):undefined
          const costLabel=linkedExpense
            ? `${money(linkedExpense.amount*expenseMultiplier(linkedExpense),linkedExpense.currency || trip.currency)} en Presupuesto · costo ${expenseStatusLabel(linkedExpense.status).toLowerCase()}${linkedExpense.amountBasis==='group'?' · grupo':''}${linkedExpense.included===false?' · fuera del total':''}`
            : r.amount!==undefined
              ? `${money(r.amount,trip.currency)} · no incluido en Presupuesto`
              : ''
          return <div key={r.id} className="list-row reservation-row"><div><strong><span className={`status-dot ${r.status==='reserved'||r.status==='paid'?'done':''}`}/>{r.title}</strong><small>{[r.dueDate?`vence ${shortDate(r.dueDate)}`:'',costLabel,r.notes].filter(Boolean).join(' · ')}</small></div><div className="reservation-actions"><select className={`chip status-select ${reservationChip(r.status)}`} aria-label={`Estado de ${r.title}`} disabled={!canEdit} value={r.status} onChange={event=>setReservationStatus(r.id,event.target.value as Reservation['status'])}><option value="watching">Esperando</option><option value="pending">Pendiente</option><option value="reserved">Reservado</option>{r.status==='paid'&&<option value="paid">Pagado (estado anterior)</option>}</select>{canEdit&&<>{linkedExpense&&<button className="icon-btn" title={`Editar costo de ${r.title}`} aria-label={`Editar el costo de ${r.title}`} onClick={()=>openItemForFacet('cost',r)}><ReceiptText size={16}/></button>}<button className="icon-btn" title={`Editar ${r.title}`} aria-label={`Editar ${r.title}`} onClick={()=>openItemForFacet('reservation',r)}><Edit3 size={16}/></button></>}</div></div>
        })}</div>
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
                {safeExternalUrl(place.url)&&<a className="icon-btn" href={safeExternalUrl(place.url)!} target="_blank" rel="noreferrer" title="Abrir enlace guardado" aria-label={`Abrir enlace guardado de ${place.name}`}><Link2 size={17}/></a>}
                {basePlace&&basePlace.id!==place.id&&<a className="icon-btn" href={mapsDirectionsUrl(placeLabel(basePlace,trip),placeLabel(place,trip))} target="_blank" rel="noreferrer" title="Ruta desde la base" aria-label={`Ruta desde la base hasta ${place.name}`}><Navigation size={17}/></a>}
                {canEdit&&!place.isBase&&<button className="icon-btn" onClick={()=>setBasePlace(place)} title="Marcar como base" aria-label={`Marcar ${place.name} como base`}><Star size={17}/></button>}
                {canEdit&&<><button className="icon-btn" title={`Editar ${place.name}`} aria-label={`Editar ${place.name}`} onClick={()=>setEditingPlace(place)}><Edit3 size={17}/></button><button className="icon-btn" title={`Eliminar ${place.name}`} aria-label={`Eliminar ${place.name}`} onClick={()=>setPlaceToDelete(place)}><Trash2 size={17}/></button></>}
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
        <div className="list">{pack.map(p=><div key={p.id} className="list-row packing-row"><div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className="packing-check" disabled={!canManagePacking} onClick={()=>togglePacking(p.id)} aria-label={`${p.packed?'Desmarcar':'Marcar'} ${p.label}`} aria-pressed={p.packed}>{p.packed?<CheckCircle2 size={20} color="var(--green)"/>:<span className="check-empty"/>}</button><div><strong style={{textDecoration:p.packed?'line-through':'none',opacity:p.packed?0.65:1}}>{p.label}</strong><small>{p.category}</small></div></div>{canManagePacking&&<div className="packing-actions"><button className="icon-btn" title={`Editar ${p.label}`} aria-label={`Editar ${p.label}`} onClick={()=>setEditingPacking(p)}><Edit3 size={16}/></button><button className="icon-btn" title={`Eliminar ${p.label}`} aria-label={`Eliminar ${p.label}`} onClick={()=>setPackingToDelete(p)}><Trash2 size={16}/></button></div>}</div>)}</div>
        {!pack.length&&<div className="empty compact">Todavía no cargaste ítems para tu valija.</div>}
      </section>}

      {tab==='Integrantes' && <section className="panel">
        <div className="panel-head">
          <div><h3>Integrantes</h3><div className="muted subcopy">Las cuentas con acceso no modifican automáticamente el presupuesto.</div></div>
          {isOwner&&<button className="btn btn-primary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
        </div>
        <div className="traveler-setting">
          <div><strong>Personas que viajan</strong><small>Se usa para calcular automáticamente el total del grupo.</small></div>
          <div className="traveler-stepper" aria-label="Cantidad de personas que viajan">
            {isOwner&&<button className="icon-btn" disabled={savingTravelerCount||travellers<=1} onClick={()=>updateTravelerCount(travellers-1)} title="Quitar viajero" aria-label="Quitar una persona"><Minus size={17}/></button>}
            <output aria-live="polite">{travellers}</output>
            {isOwner&&<button className="icon-btn" disabled={savingTravelerCount||travellers>=100} onClick={()=>updateTravelerCount(travellers+1)} title="Agregar viajero" aria-label="Agregar una persona"><Plus size={17}/></button>}
          </div>
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
              </select>:<span className={`chip ${member.role==='owner'?'green':''}`}>{tripRoleLabel(member.role)}</span>}
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

      <TripPrintView trip={trip} activities={acts} expenses={exp} reservations={res} places={places}/>

      <div className="bottom-nav">
        {(['Resumen','Itinerario','Presupuesto','Valija'] as TripTab[]).map((t,i)=>{const Icon=[CalendarDays,Clock3,DollarSign,Luggage][i];return <button key={t} className={tab===t?'active':''} onClick={()=>selectTab(t)}><Icon size={18}/>{t}</button>})}
        <button className={(['Reservas','Lugares','Integrantes'] as TripTab[]).includes(tab)||mobileMoreOpen?'active':''} onClick={()=>setMobileMoreOpen(value=>!value)} aria-expanded={mobileMoreOpen}><Menu size={18}/>Más</button>
      </div>
      {mobileMoreOpen&&<div className="mobile-more-menu" role="menu">
        {([['Reservas',ClipboardCheck],['Lugares',MapIcon],['Integrantes',Users]] as const).map(([target,Icon])=><button key={target} role="menuitem" className={tab===target?'active':''} onClick={()=>selectTab(target)}><Icon size={18}/>{target}</button>)}
      </div>}

      {editingItem&&<TripItemModal
        item={editingItem.item}
        activities={acts.filter(activity=>activity.itemId===editingItem.item.id)}
        expense={exp.find(expense=>expense.itemId===editingItem.item.id)}
        reservation={res.find(reservation=>reservation.itemId===editingItem.item.id)}
        currency={trip.currency}
        minDate={trip.startDate}
        maxDate={trip.endDate}
        categoryOptions={itemCategories}
        placeSuggestions={itemPlaceSuggestions}
        initialTab={editingItem.initialTab}
        initialFacet={editingItem.initialFacet}
        isNew={editingItem.isNew}
        onClose={()=>setEditingItem(null)}
        onSave={saveTripItem}
        onDelete={setItemToDelete}
      />}
      {editingPacking&&<PackingItemModal item={editingPacking} categoryOptions={packingCategories} onClose={()=>setEditingPacking(null)} onSave={savePacking} onDelete={setPackingToDelete}/>}
      {editingPlace&&<PlaceModal place={editingPlace} categoryOptions={placeCategories} placeSuggestions={itemPlaceSuggestions} onClose={()=>setEditingPlace(null)} onSave={savePlace} onDelete={setPlaceToDelete}/>}
      {inviteOpen&&<InviteModal tripId={trip.id} onClose={()=>setInviteOpen(false)}/>}
      {addKind&&<QuickAddModal kind={addKind} tripId={trip.id} placeSuggestions={itemPlaceSuggestions} categoryOptions={addKind==='packing'?packingCategories:placeCategories} onClose={()=>setAddKind(null)} onSave={addQuick}/>}
      {memberToRemove&&<ConfirmDialog title="Expulsar integrante" confirmLabel="Expulsar" confirmIcon={<UserMinus size={16}/>} onClose={()=>setMemberToRemove(null)} onConfirm={confirmRemoveMember}>Vas a quitar a <b>{memberToRemove.name}</b> de este viaje. Ya no podrá ver ni editar la planificación compartida.</ConfirmDialog>}
      {itemToDelete&&<ConfirmDialog title="Eliminar del viaje" confirmLabel="Eliminar todo" confirmIcon={<Trash2 size={16}/>} onClose={()=>setItemToDelete(null)} onConfirm={confirmDeleteItem}>Vas a eliminar <b>{itemToDelete.title}</b> del viaje junto con su itinerario, costo, reserva y paradas. Esta acción no se puede deshacer desde la app.</ConfirmDialog>}
      {packingToDelete&&<ConfirmDialog title="Eliminar ítem" confirmLabel="Eliminar" confirmIcon={<Trash2 size={16}/>} onClose={()=>setPackingToDelete(null)} onConfirm={confirmDeletePacking}>Vas a eliminar <b>{packingToDelete.label}</b> de tu valija. Esta acción no se puede deshacer desde la app.</ConfirmDialog>}
      {placeToDelete&&<ConfirmDialog title="Eliminar lugar" confirmLabel="Eliminar" confirmIcon={<Trash2 size={16}/>} onClose={()=>setPlaceToDelete(null)} onConfirm={confirmDeletePlace}>Vas a eliminar <b>{placeToDelete.name}</b>{placeToDelete.isBase?' y dejar el viaje sin esa base':''}. Esta acción no se puede deshacer desde la app.</ConfirmDialog>}
    </main>
  </div>
}
