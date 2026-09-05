'use client'
import { FormEvent, Suspense, useMemo, useState } from 'react'
import { Compass, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm(){
  const [identifier,setIdentifier]=useState('')
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const router=useRouter()
  const search=useSearchParams()
  const next=useMemo(()=>search.get('next') || '/dashboard',[search])

  async function submit(e:FormEvent){
    e.preventDefault()
    setMessage('')
    const supabase=createClient()
    if(!supabase){
      setMessage('Modo demo: configurá Supabase para habilitar cuentas y colaboración real.')
      return
    }
    setLoading(true)
    let email=identifier.trim()
    if(!email.includes('@')){
      const {data,error}=await supabase.rpc('resolve_login_identifier',{p_identifier:email})
      if(error || !data){
        setLoading(false)
        setMessage('No encontramos ese nombre de usuario.')
        return
      }
      email=data
    }
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setLoading(false)
    if(error){setMessage(error.message);return}
    router.replace(next)
    router.refresh()
  }

  return <main className="auth-shell">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand-mark"><Compass size={19}/></div>
      <h1>Entrá a TripMate</h1>
      <p>Planificá viajes con tu pareja, amigos o familia y mantengan todo sincronizado.</p>
      {message&&<div className="notice">{message}</div>}
      <div className="field"><label>Email o usuario</label><input value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete="username"/></div>
      <div className="field" style={{marginTop:12}}>
        <label>Contraseña</label>
        <div className="password-wrap">
          <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
          <button type="button" className="icon-btn" aria-label="Mostrar u ocultar contraseña" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
        </div>
      </div>
      <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={loading}>{loading?'Ingresando…':'Ingresar'}</button>
      <div className="auth-links">
        <Link href="/signup">Crear cuenta</Link>
        <Link href="/forgot-password">Olvidé mi contraseña</Link>
      </div>
    </form>
  </main>
}

export default function Login(){
  return <Suspense fallback={null}><LoginForm/></Suspense>
}
