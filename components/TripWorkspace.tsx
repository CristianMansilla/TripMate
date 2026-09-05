'use client'
import { useEffect, useMemo, useState } from 'react'
import { AppBar } from './AppBar'
import ActivityModal from './ActivityModal'
import InviteModal from './InviteModal'
import QuickAddModal from './QuickAddModal'
import { activities as seedActivities, expenses as seedExpenses, packing as seedPacking, reservations as seedReservations, trips as demoTrips } from '@/lib/demo-data'
import { Activity, Expense, PackingItem, Reservation, Trip, ChangeLogItem } from '@/lib/types'
import { money } from '@/lib/money'
import { createClient } from '@/lib/supabase-client'
import { activityToRow, mapActivity, mapExpense, mapPacking, mapReservation, mapTrip } from '@/lib/db-mappers'
import { logChange } from '@/lib/change-log'
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, DollarSign, Edit3, History, Luggage, MapPin, Plus, ReceiptText, Share2, UserMinus, Users, Wifi, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

const tabs = ['Resumen','Itinerario','Presupuesto','Reservas','Valija','Integrantes'] as const
type Tab = typeof tabs[number]
type AddKind = 'expense'|'reservation'|'packing'|null
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
  if(status==='paid'||status==='done'||status==='reserved') return 'green'
  if(status==='idea') return 'amber'
  return ''
}
function reservationLabel(status:Reservation['status']){
  return ({watching:'Esperando',pending:'Pendiente',reserved:'Reservado',paid:'Pagado'})[status]
}
function roleLabel(role:TripMember['role']){
  return ({owner:'Dueño',editor:'Editor',viewer:'Lector'})[role]
}
function roleDescription(role:TripMember['role']){
  return ({owner:'Organizador del viaje',editor:'Puede editar el viaje',viewer:'Sólo puede consultar'})[role]
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
  const [members,setMembers]=useState<TripMember[]>([])
  const [changes,setChanges]=useState<ChangeLogItem[]>([])
  const [editing,setEditing]=useState<Activity|null>(null)
  const [inviteOpen,setInviteOpen]=useState(false)
  const [memberToRemove,setMemberToRemove]=useState<TripMember|null>(null)
  const [addKind,setAddKind]=useState<AddKind>(null)
  const [hydrated,setHydrated]=useState(false)
  const [connected,setConnected]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const storageKey=`tripmate-demo:${tripId}`

  async function loadConnectedData(silent=false){
    const supabase=createClient()
    if(!supabase)return false
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace(`/login?next=${encodeURIComponent(`/trip/${tripId}`)}`);return true}
    setConnected(true)
    if(!silent)setLoading(true)

    const {data:tripRow,error:tripError}=await supabase.from('trips').select('*').eq('id',tripId).single()
    if(tripError){
      setError('No pudimos abrir este viaje. Verificá que seas integrante o que la invitación sea válida.')
      setLoading(false);return true
    }

    const [membersQ,actsQ,expQ,resQ,packQ,logQ]=await Promise.all([
      supabase.from('trip_members').select('role,user_id,joined_at').eq('trip_id',tripId),
      supabase.from('activities').select('*').eq('trip_id',tripId).order('date').order('start_time'),
      supabase.from('expenses').select('*').eq('trip_id',tripId).order('created_at'),
      supabase.from('reservations').select('*').eq('trip_id',tripId).order('priority'),
      supabase.from('packing_items').select('*').eq('trip_id',tripId).order('position').order('created_at'),
      supabase.from('change_log').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}).limit(8),
    ])

    const members=(membersQ.data||[]) as any[]
    const memberIds=members.map(m=>m.user_id)
    const {data:profileRows}=memberIds.length?await supabase.from('profiles').select('id,display_name,username').in('id',memberIds):{data:[] as any[]}
    const nameById=new Map<string,string>((profileRows||[]).map((p:any)=>[String(p.id),String(p.display_name || 'Viajero')]))
    const usernameById=new Map<string,string>((profileRows||[]).map((p:any)=>[String(p.id),String(p.username || '')]))
    const names:string[]=memberIds.map((id:string)=>nameById.get(id) || 'Viajero')
    const myRole=members.find(m=>m.user_id===user.id)?.role
    setMembers(members.map((m:any)=>({id:String(m.user_id),name:nameById.get(String(m.user_id)) || 'Viajero',username:usernameById.get(String(m.user_id)) || undefined,role:m.role,joinedAt:m.joined_at})))
    setTrip(mapTrip(tripRow,names,myRole))
    setActs((actsQ.data||[]).map(mapActivity))
    setExp((expQ.data||[]).map(mapExpense))
    setRes((resQ.data||[]).map(mapReservation))
    setPack((packQ.data||[]).map(mapPacking))
    setChanges((logQ.data||[]).map((r:any)=>({
      id:r.id,tripId:r.trip_id,entityType:r.entity_type,entityId:r.entity_id,action:r.action,summary:r.summary,createdAt:r.created_at
    })))
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
    localStorage.setItem(storageKey,JSON.stringify({trip,acts,exp,res,pack}))
  },[trip,acts,exp,res,pack,hydrated,connected,storageKey])

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
      .on('postgres_changes',{event:'*',schema:'public',table:'packing_items',filter:`trip_id=eq.${tripId}`},refresh)
      .subscribe()
    return()=>{clearTimeout(timer);supabase.removeChannel(channel)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[connected,tripId])

  const selectedActivities=acts.filter(a=>!a.optional || a.status!=='idea')
  const activitiesBudget=selectedActivities.reduce((s,a)=>s+(a.actualCost ?? a.estimatedCost),0)
  const fixedBudget=exp.filter(e=>e.included!==false).reduce((s,e)=>s+e.amount,0)
  const budget=Math.max(fixedBudget,activitiesBudget)
  const travellers=Math.max(1,trip.memberNames.length || 1)
  const perPerson=budget/travellers
  const pendingReservations=res.filter(r=>r.status==='pending'||r.status==='watching').length
  const packedCount=pack.filter(p=>p.packed).length
  const pctPacked=pack.length?Math.round((packedCount/pack.length)*100):0
  const dates:string[]=[...new Set<string>(acts.map(a=>a.date))].sort()
  const canEdit=trip.role!=='viewer'

  const groupedExpenses=useMemo<[string,number][]>(()=>{
    const m=new Map<string,number>()
    exp.filter(e=>e.included!==false).forEach(e=>m.set(e.category,(m.get(e.category)||0)+e.amount))
    return [...m.entries()].sort((a,b)=>b[1]-a[1])
  },[exp])
  const maxExpense=Math.max(...groupedExpenses.map(x=>x[1]),1)

  async function saveActivity(a:Activity){
    setActs(current=>current.map(x=>x.id===a.id?a:x));setEditing(null)
    const supabase=createClient()
    if(!supabase)return
    const {data:{user}}=await supabase.auth.getUser()
    const {error}=await supabase.from('activities').update({...activityToRow(a),updated_by:user?.id||null}).eq('id',a.id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'activity',a.id,'updated',`Se actualizó “${a.title}”.`)
  }

  async function addActivity(){
    if(!canEdit)return
    const date=dates[0] || trip.startDate
    const draft:Activity={
      id:`new-${Date.now()}`,tripId:trip.id,date,title:'Nueva actividad',category:'activity',
      estimatedCost:0,costScope:'shared',status:'planned',optional:false
    }
    const supabase=createClient()
    if(!supabase){setActs(c=>[...c,draft]);setEditing(draft);return}
    const {data:{user}}=await supabase.auth.getUser()
    const {data,error}=await supabase.from('activities').insert({...activityToRow(draft),created_by:user?.id||null,updated_by:user?.id||null}).select('*').single()
    if(error){setError(error.message);return}
    const created=mapActivity(data)
    setActs(c=>[...c,created]);setEditing(created)
    await logChange(trip.id,'activity',created.id,'created','Se agregó una actividad.')
  }

  function updateExpenseLocal(id:string,amount:number){setExp(c=>c.map(e=>e.id===id?{...e,amount}:e))}
  async function persistExpense(id:string){
    const current=exp.find(e=>e.id===id)
    const supabase=createClient()
    if(!supabase||!current)return
    const {error}=await supabase.from('expenses').update({amount:current.amount}).eq('id',id)
    if(error){setError(error.message);await loadConnectedData(true);return}
    await logChange(trip.id,'expense',id,'updated',`Se actualizó “${current.title}” a ${money(current.amount,trip.currency)}.`)
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
    await logChange(trip.id,'packing',id,'updated',`${next?'Se marcó':'Se desmarcó'} “${current.label}”.`)
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

  async function addQuick(payload:any){
    const supabase=createClient()
    if(addKind==='expense'){
      const item:Expense={id:`e-${Date.now()}`,tripId:trip.id,title:payload.title,category:payload.category,amount:payload.amount,status:'estimated',scope:'shared',currency:trip.currency,included:true}
      if(!supabase){setExp(c=>[...c,item]);return}
      const {data,error}=await supabase.from('expenses').insert({trip_id:trip.id,title:item.title,category:item.category,amount:item.amount,currency:trip.currency,status:'estimated',scope:'shared',included:true}).select('*').single()
      if(error)throw error
      setExp(c=>[...c,mapExpense(data)])
      await logChange(trip.id,'expense',data.id,'created',`Se agregó el gasto “${item.title}”.`)
    }
    if(addKind==='reservation'){
      const item:Reservation={id:`r-${Date.now()}`,tripId:trip.id,title:payload.title,status:'pending',priority:payload.priority,amount:payload.amount||undefined}
      if(!supabase){setRes(c=>[...c,item]);return}
      const {data,error}=await supabase.from('reservations').insert({trip_id:trip.id,title:item.title,status:'pending',priority:item.priority,amount:item.amount||null}).select('*').single()
      if(error)throw error
      setRes(c=>[...c,mapReservation(data)])
      await logChange(trip.id,'reservation',data.id,'created',`Se agregó la reserva “${item.title}”.`)
    }
    if(addKind==='packing'){
      const item:PackingItem={id:`p-${Date.now()}`,tripId:trip.id,label:payload.title,assignedTo:payload.assignedTo||'Compartido',packed:false,category:payload.category||'General'}
      if(!supabase){setPack(c=>[...c,item]);return}
      const {data,error}=await supabase.from('packing_items').insert({trip_id:trip.id,label:item.label,assigned_label:item.assignedTo,packed:false,category:item.category}).select('*').single()
      if(error)throw error
      setPack(c=>[...c,mapPacking(data)])
      await logChange(trip.id,'packing',data.id,'created',`Se agregó “${item.label}” a la valija.`)
    }
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

  if(loading)return <div className="shell"><AppBar/><main className="container"><div className="empty">Cargando viaje…</div></main></div>

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
            {trip.role==='owner'&&<button className="btn btn-secondary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
            <div className={`sync-badge ${connected?'online':'demo'}`}>{connected?<><Wifi size={13}/> Sincronizado</>:<><WifiOff size={13}/> Demo</>}</div>
            <div style={{display:'flex',marginLeft:2}}>{trip.memberNames.map((n,i)=><div key={`${n}-${i}`} className="avatar" title={n} style={{marginLeft:i?-8:0,border:'2px solid rgba(255,255,255,.6)',background:i?'#f1d9e8':'#dfe8ff'}}>{n[0]}</div>)}</div>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><span>Presupuesto estimado</span><b>{money(budget,trip.currency)}</b></div>
          <div className="stat"><span>Por persona</span><b>{money(perPerson,trip.currency)}</b></div>
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
            {acts.filter(a=>['reserved','paid'].includes(a.status)||['event','lodging'].includes(a.category)).slice(0,6).map(a=><div className="list-row" key={a.id}>
              <div><strong>{a.title}</strong><small>{shortDate(a.date)} {a.startTime?`· ${a.startTime}`:''} {a.place?`· ${a.place}`:''}</small></div>
              <span className={`chip ${activityChip(a.status)}`}>{activityStateLabel(a.status)}</span>
            </div>)}
            {!acts.length&&<div className="empty compact">Todavía no agregaron actividades.</div>}
          </div>
        </section>
        <aside style={{display:'grid',gap:18}}>
          <section className="panel">
            <div className="panel-head"><h3>Presupuesto</h3><ReceiptText size={18} className="muted"/></div>
            <div className="summary-money">{money(budget,trip.currency)}</div><div className="money-sub">{money(perPerson,trip.currency)} por persona</div>
            {groupedExpenses.slice(0,4).map(([cat,amount])=><div className="bar-row" key={cat}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></div>)}
          </section>
          <section className="panel">
            <div className="panel-head"><h3>Actividad reciente</h3><History size={18} className="muted"/></div>
            {connected&&changes.length?<div className="list">{changes.slice(0,5).map(c=><div className="change-row" key={c.id}><span className="change-dot"/><div><strong>{c.summary || c.action}</strong><small>{new Date(c.createdAt).toLocaleString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div></div>)}</div>:<div className="muted" style={{fontSize:13}}>Cuando usen Supabase, acá verán qué cambió el grupo.</div>}
          </section>
        </aside>
      </div>}

      {tab==='Itinerario' && <section className="panel">
        <div className="panel-head"><div><h3>Itinerario</h3><div className="muted subcopy">Tocá una actividad para editar horario, costo, lugar o notas.</div></div>{canEdit&&<button className="btn btn-primary" onClick={addActivity}><Plus size={16}/> Actividad</button>}</div>
        {dates.map(date=><div className="timeline-day" key={date}>
          <div className="day-heading"><strong style={{textTransform:'capitalize'}}>{dayLabel(date)}</strong><span>{acts.filter(a=>a.date===date).length} actividades</span></div>
          {acts.filter(a=>a.date===date).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')).map(a=><button key={a.id} className="activity" onClick={()=>canEdit&&setEditing(a)} style={{width:'100%',background:'transparent',borderLeft:0,borderRight:0,borderBottom:0,textAlign:'left',color:'inherit',cursor:canEdit?'pointer':'default'}}>
            <div className="activity-time">{a.startTime||'—'}{a.endTime?<><br/><span style={{fontWeight:500}}>a {a.endTime}</span></>:null}</div>
            <div><div className="activity-title">{a.title} {a.optional?<span className="chip amber">Opcional</span>:null}</div><div className="activity-sub">{a.place}{a.place&&a.notes?' · ':''}{a.notes}</div><div className="chips"><span className={`chip ${activityChip(a.status)}`}>{activityStateLabel(a.status)}</span><span className="chip">{a.category}</span></div></div>
            <div className="price">{money(a.actualCost ?? a.estimatedCost,trip.currency)} {canEdit&&<Edit3 size={13} style={{marginLeft:5,verticalAlign:'-1px',opacity:.45}}/>}</div>
          </button>)}
        </div>)}
        {!dates.length&&<div className="empty"><h3>Empezá por la primera actividad</h3><p>Podés cargar vuelos, micros, hoteles, comidas, excursiones o cualquier plan.</p>{canEdit&&<button className="btn btn-primary" onClick={addActivity}>Agregar actividad</button>}</div>}
      </section>}

      {tab==='Presupuesto' && <div className="two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Presupuesto editable</h3><div className="muted subcopy">Importes del viaje completo. Podés cambiarlos cuando averigüen precios reales.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('expense')}><Plus size={16}/> Gasto</button>}</div>
          <div className="list">{exp.map(e=><div className={`list-row budget-line ${e.included===false?'excluded':''}`} key={e.id} style={{alignItems:'center'}}><div style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className={`budget-check ${e.included!==false?'on':''}`} disabled={!canEdit} onClick={()=>toggleExpenseIncluded(e.id)} aria-label={`${e.included!==false?'Excluir':'Incluir'} ${e.title}`}>{e.included!==false?'✓':''}</button><div><strong>{e.title}</strong><small>{e.category} · {e.status}{e.included===false?' · fuera del total':''}</small></div></div><div className="money-input"><span>{trip.currency}</span><input aria-label={`Costo ${e.title}`} disabled={!canEdit} type="number" value={e.amount} onChange={ev=>updateExpenseLocal(e.id,Number(ev.target.value))} onBlur={()=>persistExpense(e.id)}/></div></div>)}</div>
        </section>
        <aside className="panel">
          <h3>Total del viaje</h3><div className="summary-money">{money(fixedBudget,trip.currency)}</div><div className="money-sub">{money(fixedBudget/travellers,trip.currency)} por persona · {travellers} viajeros</div>
          <div className="budget-buffer"><b>+15% recomendado:</b><br/>{money(fixedBudget*1.15,trip.currency)} disponibles para absorber cambios e imprevistos.</div>
          {groupedExpenses.map(([cat,amount])=><div className="bar-row" key={cat}><div className="bar-label"><span>{cat}</span><b>{money(amount,trip.currency)}</b></div><div className="bar"><i style={{width:`${Math.max(8,(amount/maxExpense)*100)}%`}}/></div></div>)}
        </aside>
      </div>}

      {tab==='Reservas' && <section className="panel">
        <div className="panel-head"><div><h3>Reservas y compras</h3><div className="muted subcopy">Cambien el estado a medida que investigan o compran.</div></div>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('reservation')}><Plus size={16}/> Reserva</button>}</div>
        <div className="list">{res.map(r=><button key={r.id} className="list-row" disabled={!canEdit} style={{width:'100%',background:'white',textAlign:'left',color:'inherit',cursor:canEdit?'pointer':'default'}} onClick={()=>cycleReservation(r.id)}><div><strong><span className={`status-dot ${r.status==='reserved'||r.status==='paid'?'done':''}`}/>{r.title}</strong><small>{r.notes || (r.amount?money(r.amount,trip.currency):'')}</small></div><span className={`chip ${r.status==='reserved'||r.status==='paid'?'green':r.priority==='high'?'red':'amber'}`}>{reservationLabel(r.status)}</span></button>)}</div>
        {!res.length&&<div className="empty compact">No hay reservas cargadas.</div>}
      </section>}

      {tab==='Valija' && <section className="panel">
        <div className="panel-head"><div><h3>Valija compartida</h3><div className="muted subcopy">{packedCount} de {pack.length} listos.</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}>{canEdit&&<button className="btn btn-primary" onClick={()=>setAddKind('packing')}><Plus size={16}/> Ítem</button>}<Luggage size={19} className="muted"/></div></div>
        <div className="progress" style={{marginBottom:16}}><i style={{width:`${pctPacked}%`}}/></div>
        <div className="list">{pack.map(p=><button key={p.id} className="list-row" disabled={!canEdit} style={{width:'100%',background:'white',textAlign:'left',color:'inherit',cursor:canEdit?'pointer':'default'}} onClick={()=>togglePacking(p.id)}><div style={{display:'flex',alignItems:'center',gap:10}}>{p.packed?<CheckCircle2 size={20} color="var(--green)"/>:<span className="check-empty"/>}<div><strong style={{textDecoration:p.packed?'line-through':'none',opacity:p.packed?0.65:1}}>{p.label}</strong><small>{p.assignedTo} · {p.category}</small></div></div></button>)}</div>
      </section>}

      {tab==='Integrantes' && <section className="panel">
        <div className="panel-head">
          <div><h3>Integrantes</h3><div className="muted subcopy">Personas que tienen acceso a este viaje.</div></div>
          {trip.role==='owner'&&<button className="btn btn-primary" onClick={()=>setInviteOpen(true)}><Share2 size={16}/> Invitar</button>}
        </div>
        <div className="list">
          {members.length?members.map(member=><div className="list-row" key={member.id}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div className="avatar">{member.name[0]}</div>
              <div><strong>{member.name}</strong><small>{member.username?`@${member.username} · `:''}{roleDescription(member.role)}{member.joinedAt?` · desde ${shortDate(member.joinedAt.slice(0,10))}`:''}</small></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {trip.role==='owner'&&member.role!=='owner'?<select className="role-select" value={member.role} onChange={e=>updateMemberRole(member,e.target.value as TripMember['role'])}>
                <option value="editor">Editor</option>
                <option value="viewer">Lector</option>
              </select>:<span className={`chip ${member.role==='owner'?'green':''}`}>{roleLabel(member.role)}</span>}
              {trip.role==='owner'&&member.role!=='owner'&&<button className="icon-btn" title={`Expulsar a ${member.name}`} aria-label={`Expulsar a ${member.name}`} onClick={()=>setMemberToRemove(member)}><UserMinus size={17}/></button>}
            </div>
          </div>):trip.memberNames.map((name,i)=><div className="list-row" key={`${name}-${i}`}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div className="avatar">{name[0]}</div>
              <div><strong>{name}</strong><small>Integrante del viaje</small></div>
            </div>
          </div>)}
        </div>
      </section>}

      <div className="bottom-nav">{tabs.map((t,i)=>{const Icon=[CalendarDays,Clock3,DollarSign,ClipboardCheck,Luggage,Users][i];return <button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}><Icon size={18}/>{t}</button>})}</div>

      {editing&&<ActivityModal activity={editing} onClose={()=>setEditing(null)} onSave={saveActivity}/>}
      {inviteOpen&&<InviteModal tripId={trip.id} onClose={()=>setInviteOpen(false)}/>}
      {addKind&&<QuickAddModal kind={addKind} onClose={()=>setAddKind(null)} onSave={addQuick}/>}
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
    </main>
  </div>
}
