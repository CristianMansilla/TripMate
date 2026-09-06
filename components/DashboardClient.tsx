'use client'
import Link from 'next/link'
import { AppBar } from './AppBar'
import NewTripModal from './NewTripModal'
import { trips as demoTrips } from '@/lib/demo-data'
import { Trip } from '@/lib/types'
import { CalendarDays, MapPin, Plus, Users, Wifi, WifiOff } from 'lucide-react'
import { createClient, hasSupabaseEnv } from '@/lib/supabase-client'
import { mapTrip } from '@/lib/db-mappers'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tripRoleLabel } from '@/lib/ui-text'

function dateRange(start:string,end:string){
  const a=new Date(start+'T12:00:00'), b=new Date(end+'T12:00:00')
  return `${a.toLocaleDateString('es-AR',{day:'numeric',month:'short'})} — ${b.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}`
}

export default function DashboardClient(){
  const [trips,setTrips]=useState<Trip[]>(hasSupabaseEnv()?[]:demoTrips)
  const [loading,setLoading]=useState(hasSupabaseEnv())
  const [connected,setConnected]=useState(false)
  const [error,setError]=useState('')
  const [reloadKey,setReloadKey]=useState(0)
  const [showNew,setShowNew]=useState(false)
  const router=useRouter()

  useEffect(()=>{
    let alive=true
    async function load(){
      setError('')
      const supabase=createClient()
      if(!supabase){setLoading(false);return}
      const {data:{user}}=await supabase.auth.getUser()
      if(!alive)return
      if(!user){router.replace('/login');return}
      setConnected(true)

      const pendingCode=localStorage.getItem('tripmate-pending-invite-code')
      if(pendingCode){
        const {data,error}=await supabase.rpc('join_trip_by_code',{p_code:pendingCode})
        if(!error&&data){
          localStorage.removeItem('tripmate-pending-invite-code')
          router.replace(`/trip/${data}`)
          return
        }
        localStorage.removeItem('tripmate-pending-invite-code')
        if(error)setError('No pudimos aceptar la invitación. Puede haber vencido o alcanzado su límite de usos.')
      }

      const {data:memberships,error}=await supabase
        .from('trip_members')
        .select('role, trips(*)')
        .eq('user_id',user.id)
        .order('joined_at',{ascending:false})
      if(error){setError('No pudimos cargar tus viajes. Revisá la conexión e intentá nuevamente.');setLoading(false);return}

      const loaded:Trip[]=[]
      for(const membership of memberships || []){
        const row:any=(membership as any).trips
        if(!row)continue
        const {data:memberRows}=await supabase.from('trip_members').select('user_id').eq('trip_id',row.id)
        const ids=(memberRows||[]).map((m:any)=>m.user_id)
        const {data:profiles}=ids.length?await supabase.from('profiles').select('id,display_name').in('id',ids):{data:[] as any[]}
        const nameById=new Map<string,string>((profiles||[]).map((p:any)=>[String(p.id),String(p.display_name || 'Viajero')]))
        const names:string[]=ids.map((id:string)=>nameById.get(id) || 'Viajero')
        loaded.push(mapTrip(row,names,(membership as any).role))
      }
      if(alive){setTrips(loaded);setLoading(false)}
    }
    load()
    return()=>{alive=false}
  },[router,reloadKey])

  async function createTrip(input:Omit<Trip,'id'|'status'|'memberNames'>){
    const supabase=createClient()
    if(!supabase){
      const id=`demo-${Date.now()}`
      const trip:Trip={...input,id,status:'planning',memberNames:['Demo'],role:'owner'}
      setTrips(c=>[trip,...c])
      localStorage.setItem(`tripmate-demo:${id}`,JSON.stringify({trip,acts:[],exp:[],res:[],pack:[]}))
      router.push(`/trip/${id}`)
      return
    }
    const {data,error}=await supabase.rpc('create_trip',{
      p_name:input.name,
      p_destination:input.destination,
      p_country:input.country || null,
      p_start_date:input.startDate,
      p_end_date:input.endDate,
      p_currency:input.currency,
    })
    if(error)throw error
    router.push(`/trip/${data}`)
  }

  return <div className="shell">
    <AppBar onNewTrip={()=>setShowNew(true)}/>
    <main className="container">
      <div className="topline">
        <div><h1>Tus viajes</h1><p>Planificá, compartí y mantené todo actualizado en un solo lugar.</p></div>
        <button className="btn btn-primary" onClick={()=>setShowNew(true)}><Plus size={17}/> Nuevo viaje</button>
      </div>

      <div className={`connection-pill ${connected&&!error?'online':'demo'}`}>
        {connected&&!error?<><Wifi size={14}/> Conectado · cambios compartidos</>:hasSupabaseEnv()?<><WifiOff size={14}/> Sin conexión</>:<><WifiOff size={14}/> Modo demo · cambios sólo en este navegador</>}
      </div>

      {error&&<div className="notice error dismissible" role="alert">{error}<button onClick={()=>{setLoading(true);setReloadKey(key=>key+1)}}>Reintentar</button></div>}
      {loading?<div className="grid-trips skeleton-grid" aria-busy="true" aria-label="Cargando tus viajes">{[0,1,2].map(item=><div className="trip-card skeleton-card" key={item}><div className="skeleton-block skeleton-cover"/><div className="trip-body"><div className="skeleton-line wide"/><div className="skeleton-line"/></div></div>)}</div>:trips.length===0?<div className="empty"><h3>Todavía no tenés viajes</h3><p>Creá el primero o abrí un enlace de invitación para sumarte a uno compartido.</p><div className="empty-actions"><button className="btn btn-primary" onClick={()=>setShowNew(true)}>Crear mi primer viaje</button></div></div>:
      <div className="grid-trips">
        {trips.map((trip)=><Link className="trip-card" href={`/trip/${trip.id}`} key={trip.id}>
          <div className="trip-cover">
            <div className="date-pill"><CalendarDays size={13} style={{verticalAlign:'-2px',marginRight:5}}/>{dateRange(trip.startDate,trip.endDate)}</div>
            <div><div style={{opacity:.72,fontSize:13,marginBottom:6}}><MapPin size={13} style={{verticalAlign:'-2px'}}/> {trip.destination}</div><h2>{trip.name}</h2></div>
          </div>
          <div className="trip-body">
            <div className="trip-meta"><span><Users size={14} style={{verticalAlign:'-2px'}}/> {trip.memberNames.join(' · ') || 'Sólo vos'}</span><span>{tripRoleLabel(trip.role || 'demo')}</span></div>
          </div>
        </Link>)}
        <button className="trip-card dashed-card" onClick={()=>setShowNew(true)}><span><Plus size={28}/><br/><b>Crear otro viaje</b><br/><small>Brasil, Bariloche, Europa…</small></span></button>
      </div>}
      {showNew&&<NewTripModal onClose={()=>setShowNew(false)} onCreate={createTrip}/>}
    </main>
  </div>
}
