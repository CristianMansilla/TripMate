'use client'
import { FormEvent, useState } from 'react'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { userFacingError } from '@/lib/ui-text'
import Snackbar from '@/components/Snackbar'

export default function ForgotPassword(){
  const [email,setEmail]=useState('')
  const [message,setMessage]=useState('')
  const [sent,setSent]=useState(false)
  const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault()
    const supabase=createClient()
    if(!supabase){setSent(false);setMessage('Configurá Supabase para habilitar recuperación.');return}
    setLoading(true)
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent('/update-password')}`})
    setLoading(false)
    setSent(!error)
    setMessage(error?userFacingError(error,'No pudimos enviar el email de recuperación. Intentá nuevamente.'):'Te enviamos un enlace para cambiar tu contraseña.')
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Recuperar contraseña</h1>
    <p>Ingresá tu email y te enviamos un enlace seguro.</p>
    <Snackbar message={message} tone={sent?'success':'error'} onClose={()=>setMessage('')} duration={sent?0:6000}/>
    <div className="field"><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={loading}>{loading?'Enviando…':'Enviar enlace'}</button>
    <div className="auth-links"><Link href="/login">Volver a ingresar</Link></div>
  </form></main>
}
