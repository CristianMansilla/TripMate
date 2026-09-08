'use client'
import { FormEvent, useState } from 'react'
import { Compass } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { userFacingError } from '@/lib/ui-text'
import Snackbar from '@/components/Snackbar'

export default function UpdatePassword(){
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const router=useRouter()
  async function submit(e:FormEvent){
    e.preventDefault()
    const supabase=createClient()
    if(!supabase){setMessage('Supabase no está configurado.');return}
    setLoading(true)
    try{
      const {error}=await supabase.auth.updateUser({password})
      if(error){setMessage(userFacingError(error,'No pudimos actualizar la contraseña. Intentá nuevamente.'));return}
      sessionStorage.setItem('tripmate-success','Contraseña guardada.')
      router.replace('/dashboard')
      router.refresh()
    }finally{
      setLoading(false)
    }
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="brand-mark"><Compass size={19}/></div>
    <h1>Nueva contraseña</h1><p>Elegí una contraseña nueva para tu cuenta.</p>
    <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
    <div className="field"><label htmlFor="new-password">Contraseña nueva</label><input id="new-password" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password"/></div>
    <button className="btn btn-primary" style={{width:'100%',marginTop:18}} disabled={loading}>{loading?'Guardando…':'Guardar contraseña'}</button>
  </form></main>
}
