'use client'
import Link from 'next/link'
import { Compass, LogOut, Plus, Save, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'
import Snackbar from './Snackbar'

export function AppBar({onNewTrip}:{onNewTrip?:()=>void}) {
  const [name,setName]=useState('')
  const [username,setUsername]=useState('')
  const [draftName,setDraftName]=useState('')
  const [draftUsername,setDraftUsername]=useState('')
  const [email,setEmail]=useState('')
  const [profileLoaded,setProfileLoaded]=useState(false)
  const [profileOpen,setProfileOpen]=useState(false)
  const [profileMessage,setProfileMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [connected,setConnected]=useState(false)
  const [mounted,setMounted]=useState(false)
  const router=useRouter()
  const closeProfile=useCallback(()=>{
    if(saving)return
    setDraftName(name)
    setDraftUsername(username)
    setProfileOpen(false)
  },[name,saving,username])
  const openProfile=()=>{
    setDraftName(name)
    setDraftUsername(username)
    setProfileOpen(true)
  }
  const profileDialogRef=useModalBehavior<HTMLDivElement>(closeProfile,profileOpen)
  const runOnce=useSubmissionGuard()

  useEffect(()=>{
    setMounted(true)
    const supabase=createClient()
    if(!supabase)return
    setConnected(true)
    supabase.auth.getUser().then(async ({data})=>{
      const user=data.user
      if(!user){setProfileLoaded(true);return}
      setEmail(user.email || '')
      const fallback=user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario'
      const {data:profile}=await supabase.from('profiles').select('display_name,username').eq('id',user.id).single()
      const loadedName=profile?.display_name || fallback
      const loadedUsername=profile?.username || ''
      setName(loadedName)
      setUsername(loadedUsername)
      setDraftName(loadedName)
      setDraftUsername(loadedUsername)
      setProfileLoaded(true)
    })
  },[])

  async function logout(){
    const supabase=createClient()
    if(supabase) await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  async function saveProfile(){
    await runOnce(async()=>{
    setProfileMessage('')
    const cleanName=draftName.trim()
    const cleanUsername=draftUsername.trim().toLowerCase()
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
    const {error}=await supabase.from('profiles').update({display_name:cleanName,username:cleanUsername}).eq('id',user.id)
    if(error){setProfileMessage(error.code==='23505'?'Ese nombre de usuario ya está en uso.':'No pudimos guardar el perfil. Intentá nuevamente.');setSaving(false);return}
    await supabase.auth.updateUser({data:{name:cleanName,username:cleanUsername}})
    setName(cleanName)
    setUsername(cleanUsername)
    setDraftName(cleanName)
    setDraftUsername(cleanUsername)
    setSaving(false)
    setProfileMessage('Perfil actualizado.')
    setProfileOpen(false)
    })
  }

  const profileModal=profileOpen&&mounted?createPortal(
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeProfile()}}>
      <div ref={profileDialogRef} className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" tabIndex={-1}>
        <h2 id="profile-title">Perfil</h2>
        <p className="muted">Estos datos se muestran a las personas que comparten viajes con vos.</p>
        <div className="field"><label htmlFor="profile-name">Nombre visible</label><input id="profile-name" value={draftName} onChange={e=>setDraftName(e.target.value)} required autoComplete="name"/></div>
        <div className="field" style={{marginTop:12}}><label htmlFor="profile-username">Nombre de usuario</label><input id="profile-username" value={draftUsername} onChange={e=>setDraftUsername(e.target.value.toLowerCase())} required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" autoComplete="username"/></div>
        <div className="field" style={{marginTop:12}}><label htmlFor="profile-email">Email</label><input id="profile-email" value={email} disabled/></div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={closeProfile} disabled={saving}>Cancelar</button>
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
          <button className="avatar avatar-button" title="Editar perfil" aria-label="Editar perfil" onClick={()=>profileLoaded&&openProfile()} disabled={!profileLoaded}>{name[0]?.toUpperCase() || <UserRound size={16}/>}</button>
          {profileLoaded&&name&&<button className="desktop-label user-name user-name-button" onClick={openProfile}>{name}</button>}
          {connected&&<button className="icon-btn" title="Cerrar sesión" onClick={logout}><LogOut size={16}/></button>}
        </div>
      </div>
    </div>
  </header>
  {profileModal}
  <Snackbar message={profileMessage} tone={profileMessage==='Perfil actualizado.'?'success':'error'} onClose={()=>setProfileMessage('')}/>
  </>
}
