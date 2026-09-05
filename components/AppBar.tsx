'use client'
import Link from 'next/link'
import { Compass, LogOut, Plus, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function AppBar({onNewTrip}:{onNewTrip?:()=>void}) {
  const [name,setName]=useState('Demo')
  const [connected,setConnected]=useState(false)
  const router=useRouter()

  useEffect(()=>{
    const supabase=createClient()
    if(!supabase)return
    setConnected(true)
    supabase.auth.getUser().then(({data})=>{
      const user=data.user
      if(user)setName(user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario')
    })
  },[])

  async function logout(){
    const supabase=createClient()
    if(supabase) await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return <header className="appbar">
    <div className="appbar-inner">
      <Link className="brand" href="/dashboard"><span className="brand-mark"><Compass size={19}/></span>TripMate</Link>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {onNewTrip&&<button className="btn btn-secondary" style={{padding:'9px 12px'}} onClick={onNewTrip}><Plus size={16}/><span className="desktop-label">Viaje</span></button>}
        <div className="user-menu">
          <div className="avatar" title={name}>{name[0]?.toUpperCase() || <UserRound size={16}/>}</div>
          <span className="desktop-label user-name">{name}</span>
          {connected&&<button className="icon-btn" title="Cerrar sesión" onClick={logout}><LogOut size={16}/></button>}
        </div>
      </div>
    </div>
  </header>
}
