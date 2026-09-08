'use client'
import { FormEvent, Suspense, useMemo, useState } from 'react'
import { Compass, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { safeInternalPath } from '@/lib/safe-redirect'
import Snackbar from '@/components/Snackbar'

function LoginForm(){
  const [identifier,setIdentifier]=useState('')
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const router=useRouter()
  const search=useSearchParams()
  const next=useMemo(()=>safeInternalPath(search.get('next')),[search])

  async function submit(e:FormEvent){
    e.preventDefault()
    setMessage('')
    const supabase=createClient()
    if(!supabase){
      setMessage('Modo demo: configurá Supabase para habilitar cuentas y colaboración real.')
      return
    }
    setLoading(true)
    try{
      const response=await fetch('/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({identifier,password}),
      })
      const result=await response.json().catch(()=>({message:'No pudimos iniciar sesión. Intentá nuevamente.'}))
      if(!response.ok){setMessage(result.message);return}
      router.replace(next)
      router.refresh()
    }catch{
      setMessage('No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.')
    }finally{
      setLoading(false)
    }
  }

  return <main className="auth-shell">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand-mark"><Compass size={19}/></div>
      <h1>Entrá a TripMate</h1>
      <p>Planificá viajes con tu pareja, amigos o familia y mantengan todo sincronizado.</p>
      <Snackbar message={message} tone={message.startsWith('Modo demo')?'info':'error'} onClose={()=>setMessage('')}/>
      <div className="field"><label htmlFor="login-identifier">Email o usuario</label><input id="login-identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoComplete="username"/></div>
      <div className="field" style={{marginTop:12}}>
        <label htmlFor="login-password">Contraseña</label>
        <div className="password-wrap">
          <input id="login-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
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
