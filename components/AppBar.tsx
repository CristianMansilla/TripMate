'use client'
import Link from 'next/link'
import { Compass, LogOut, Plus, Save, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export function AppBar({onNewTrip}:{onNewTrip?:()=>void}) {
  const [name,setName]=useState('Usuario')
  const [username,setUsername]=useState('')
  const [email,setEmail]=useState('')
  const [profileOpen,setProfileOpen]=useState(false)
  const [profileMessage,setProfileMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [connected,setConnected]=useState(false)
  const [mounted,setMounted]=useState(false)
  const router=useRouter()

  useEffect(()=>{
    setMounted(true)
    const supabase=createClient()
    if(!supabase)return
    setConnected(true)
    supabase.auth.getUser().then(async ({data})=>{
      const user=data.user
      if(!user)return
      setEmail(user.email || '')
      const fallback=user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario'
      const {data:profile}=await supabase.from('profiles').select('display_name,username').eq('id',user.id).single()
      setName(profile?.display_name || fallback)
      setUsername(profile?.username || '')
    })
  },[])

  async function logout(){
    const supabase=createClient()
    if(supabase) await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  async function saveProfile(){
    setProfileMessage('')
    const cleanName=name.trim()
    const cleanUsername=username.trim().toLowerCase()
    if(!cleanName){setProfileMessage('El nombre no puede estar vacío.');return}
    if(!/^[a-z0-9_]{3,24}$/.test(cleanUsername)){
      setProfileMessage('El usuario debe tener entre 3 y 24 caracteres: letras, números o guion bajo.')
      return
    }
    const supabase=createClient()
    if(!supabase)return
    setSaving(true)
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){setSaving(false);setProfileMessage('Tu sesión venció. Volvé a iniciar sesión.');return}
    const {data:existing}=await supabase.rpc('resolve_login_identifier',{p_identifier:cleanUsername})
    if(existing && existing!==user.email){
      setSaving(false)
      setProfileMessage('Ese nombre de usuario ya está en uso.')
      return
    }
    const {error}=await supabase.from('profiles').update({display_name:cleanName,username:cleanUsername}).eq('id',user.id)
    if(error){setProfileMessage(error.message);setSaving(false);return}
    await supabase.auth.updateUser({data:{name:cleanName,username:cleanUsername}})
    setName(cleanName)
    setUsername(cleanUsername)
    setSaving(false)
    setProfileOpen(false)
  }

  const profileModal=profileOpen&&mounted?createPortal(
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProfileOpen(false)}}>
      <div className="modal confirm-modal">
        <h2>Perfil</h2>
        <p className="muted">Estos datos se muestran a las personas que comparten viajes con vos.</p>
        {profileMessage&&<div className="notice error">{profileMessage}</div>}
        <div className="field"><label>Nombre visible</label><input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></div>
        <div className="field" style={{marginTop:12}}><label>Nombre de usuario</label><input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" autoComplete="username"/></div>
        <div className="field" style={{marginTop:12}}><label>Email</label><input value={email} disabled/></div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={()=>setProfileOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><Save size={16}/>{saving?'Guardando…':'Guardar'}</button>
        </div>
      </div>
    </div>,
    document.body
  ):null

  return <>
  <header className="appbar">
    <div className="appbar-inner">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Compass size={19}/></span>TripMate</Link>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {onNewTrip&&<button className="btn btn-secondary" style={{padding:'9px 12px'}} onClick={onNewTrip}><Plus size={16}/><span className="desktop-label">Viaje</span></button>}
        <div className="user-menu">
          <button className="avatar avatar-button" title="Editar perfil" onClick={()=>setProfileOpen(true)}>{name[0]?.toUpperCase() || <UserRound size={16}/>}</button>
          <button className="desktop-label user-name user-name-button" onClick={()=>setProfileOpen(true)}>{name}</button>
          {connected&&<button className="icon-btn" title="Cerrar sesión" onClick={logout}><LogOut size={16}/></button>}
        </div>
      </div>
    </div>
  </header>
  {profileModal}
  </>
}
