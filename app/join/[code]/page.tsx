'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function JoinPage(){
  const params=useParams<{code:string}>()
  const code=params.code
  const router=useRouter()
  const [state,setState]=useState<'checking'|'login'|'joining'|'error'>('checking')
  const [message,setMessage]=useState('')

  useEffect(()=>{
    let alive=true
    async function run(){
      const supabase=createClient()
      if(!supabase){
        if(alive){setState('error');setMessage('Supabase todavía no está configurado en esta instalación.')}
        return
      }
      const {data:{user}}=await supabase.auth.getUser()
      if(!alive)return
      if(!user){
        localStorage.setItem('tripmate-pending-invite-code',code)
        setState('login')
        return
      }
      setState('joining')
      localStorage.removeItem('tripmate-pending-invite-code')
      const {data,error}=await supabase.rpc('join_trip_by_code',{p_code:code})
      if(!alive)return
      if(error){setState('error');setMessage(error.message);return}
      router.replace(`/trip/${data}`)
      router.refresh()
    }
    run()
    return()=>{alive=false}
  },[code,router])

  const next=`/join/${code}`
  return <main className="auth-shell"><section className="auth-card">
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Invitación a un viaje</h1>
    {state==='checking'&&<p>Validando invitación…</p>}
    {state==='joining'&&<p>Sumándote al viaje…</p>}
    {state==='login'&&<><p>Para aceptar la invitación primero necesitás iniciar sesión o crear una cuenta.</p>
      <Link className="btn btn-primary" style={{width:'100%'}} href={`/login?next=${encodeURIComponent(next)}`}>Ingresar</Link>
      <Link className="btn btn-secondary" style={{width:'100%',marginTop:9}} href={`/signup?next=${encodeURIComponent(next)}`}>Crear cuenta</Link></>}
    {state==='error'&&<><div className="notice error">{message}</div><Link className="btn btn-secondary" href="/dashboard">Volver al inicio</Link></>}
  </section></main>
}
