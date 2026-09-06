'use client'
import { FormEvent, useState } from 'react'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { userFacingError } from '@/lib/ui-text'

export default function UpdatePassword(){
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  const router=useRouter()
  async function submit(e:FormEvent){
    e.preventDefault()
    const supabase=createClient()
    if(!supabase){setMessage('Supabase no está configurado.');return}
    const {error}=await supabase.auth.updateUser({password})
    if(error){setMessage(userFacingError(error,'No pudimos actualizar la contraseña. Intentá nuevamente.'));return}
    router.replace('/dashboard')
    router.refresh()
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Nueva contraseña</h1><p>Elegí una contraseña nueva para tu cuenta.</p>
    {message&&<div className="notice">{message}</div>}
    <div className="field"><label>Contraseña nueva</label><input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:18}}>Guardar contraseña</button>
  </form></main>
}
