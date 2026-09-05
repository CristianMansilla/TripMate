'use client'
import { FormEvent, useState } from 'react'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

export default function ForgotPassword(){
  const [email,setEmail]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault()
    const supabase=createClient()
    if(!supabase){setMessage('Configurá Supabase para habilitar recuperación.');return}
    setLoading(true)
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent('/update-password')}`})
    setLoading(false)
    setMessage(error?error.message:'Te enviamos un enlace para cambiar tu contraseña.')
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Recuperar contraseña</h1>
    <p>Ingresá tu email y te enviamos un enlace seguro.</p>
    {message&&<div className="notice">{message}</div>}
    <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={loading}>{loading?'Enviando…':'Enviar enlace'}</button>
    <div className="auth-links"><Link href="/login">Volver a ingresar</Link></div>
  </form></main>
}
