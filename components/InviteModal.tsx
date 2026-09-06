'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import type { TripRole } from '@/lib/types'
import { useModalBehavior } from './useModalBehavior'

export default function InviteModal({tripId,onClose}:{tripId:string,onClose:()=>void}){
  useModalBehavior(onClose)
  const [role,setRole]=useState<TripRole>('editor')
  const [url,setUrl]=useState('')
  const [loading,setLoading]=useState(false)
  const [copied,setCopied]=useState(false)
  const [message,setMessage]=useState('')

  async function generate(){
    setLoading(true);setMessage('')
    const supabase=createClient()
    if(!supabase){
      setMessage('En modo demo no se pueden crear invitaciones reales.')
      setLoading(false);return
    }
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setMessage('Tu sesión venció. Volvé a iniciar sesión.');setLoading(false);return}
    const {data,error}=await supabase.from('trip_invites').insert({
      trip_id:tripId,role,max_uses:10,created_by:user.id
    }).select('code').single()
    setLoading(false)
    if(error){setMessage(error.message);return}
    setUrl(`${window.location.origin}/join/${data.code}`)
  }

  async function copy(){
    if(!url)return
    try{
      await navigator.clipboard.writeText(url)
      setCopied(true);setTimeout(()=>setCopied(false),1500)
    }catch{
      setMessage('No pudimos copiar el enlace. Seleccionalo manualmente.')
    }
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
      <h2 id="invite-modal-title">Invitar al viaje</h2>
      <p className="muted">Generá un enlace. La persona deberá crear o iniciar sesión antes de unirse.</p>
      {message&&<div className="notice">{message}</div>}
      <div className="field"><label htmlFor="invite-role">Permiso</label><select id="invite-role" value={role} onChange={e=>setRole(e.target.value as TripRole)} disabled={Boolean(url)}>
        <option value="editor">Editor · puede modificar</option>
        <option value="viewer">Lector · sólo consulta</option>
      </select></div>
      {!url?<button className="btn btn-primary" style={{marginTop:18,width:'100%'}} onClick={generate} disabled={loading}>{loading?'Generando…':'Generar enlace'}</button>:
      <div className="invite-box"><input readOnly value={url}/><button className="btn btn-secondary" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copiado':'Copiar'}</button></div>}
      <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>
}
