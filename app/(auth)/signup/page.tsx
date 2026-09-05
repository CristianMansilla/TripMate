'use client'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import { Compass, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SignupForm(){
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const [created,setCreated]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirmPassword,setShowConfirmPassword]=useState(false)
  const search=useSearchParams()
  const next=search.get('next') || '/dashboard'

  useEffect(()=>{
    const match=next.match(/^\/join\/([^/?#]+)/)
    if(match) localStorage.setItem('tripmate-pending-invite-code',match[1])
  },[next])

  async function submit(e:FormEvent){
    e.preventDefault()
    setMessage('')
    if(password!==confirmPassword){
      setMessage('Las contraseñas no coinciden.')
      return
    }
    const supabase=createClient()
    if(!supabase){setMessage('Configurá Supabase para habilitar registro.');return}
    setLoading(true)
    const redirectTo=`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const {error}=await supabase.auth.signUp({
      email,password,
      options:{data:{name},emailRedirectTo:redirectTo}
    })
    setLoading(false)
    if(error){setMessage(error.message);return}
    setCreated(true)
    setMessage('Cuenta creada. Revisá tu email para confirmar la cuenta. Si no lo ves, buscá también en correo no deseado o spam.')
  }

  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Creá tu cuenta</h1>
    <p>Después vas a poder crear viajes e invitar a otras personas.</p>
    {message&&<div className="notice">{message}</div>}
    <div className="field"><label>Nombre</label><input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></div>
    <div className="field" style={{marginTop:12}}><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
    <div className="field" style={{marginTop:12}}>
      <label>Contraseña</label>
      <div className="password-wrap">
        <input type={showPassword?'text':'password'} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password"/>
        <button type="button" className="icon-btn" aria-label="Mostrar u ocultar contraseña" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
      </div>
    </div>
    <div className="field" style={{marginTop:12}}>
      <label>Confirmar contraseña</label>
      <div className="password-wrap">
        <input type={showConfirmPassword?'text':'password'} minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required autoComplete="new-password"/>
        <button type="button" className="icon-btn" aria-label="Mostrar u ocultar confirmación de contraseña" onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>
      </div>
    </div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={loading||created}>{loading?'Creando…':created?'Cuenta creada':'Crear cuenta'}</button>
    <div className="auth-links"><Link href="/login">Ya tengo cuenta</Link></div>
  </form></main>
}

export default function Signup(){
  return <Suspense fallback={null}><SignupForm/></Suspense>
}
