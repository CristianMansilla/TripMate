'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type SnackbarTone='error'|'success'|'info'

export default function Snackbar({message,tone='info',onClose,actionLabel,onAction,duration=6000,notificationId}:{
  message:string
  tone?:SnackbarTone
  onClose:()=>void
  actionLabel?:string
  onAction?:()=>void
  duration?:number
  notificationId?:number
}){
  const [host,setHost]=useState<HTMLElement|null>(null)
  const onCloseRef=useRef(onClose)
  useEffect(()=>{onCloseRef.current=onClose},[onClose])
  useEffect(()=>{
    let region=document.getElementById('snackbar-region')
    if(!region){
      region=document.createElement('div')
      region.id='snackbar-region'
      region.className='snackbar-region'
      region.setAttribute('aria-label','Notificaciones')
      document.body.appendChild(region)
    }
    setHost(region)
  },[])
  useEffect(()=>{
    if(!message || duration<=0)return
    const timer=window.setTimeout(()=>onCloseRef.current(),duration)
    return()=>window.clearTimeout(timer)
  },[message,duration,notificationId])
  if(!host || !message)return null
  const Icon=tone==='error'?AlertCircle:tone==='success'?CheckCircle2:Info
  return createPortal(
    <div className={`snackbar ${tone}`} role={tone==='error'?'alert':'status'} aria-live={tone==='error'?'assertive':'polite'}>
      <Icon size={19} aria-hidden="true"/>
      <span>{message}</span>
      {actionLabel&&onAction&&<button type="button" className="snackbar-action" onClick={onAction}>{actionLabel}</button>}
      <button type="button" className="snackbar-close" onClick={onClose} title="Cerrar mensaje" aria-label="Cerrar mensaje"><X size={17}/></button>
    </div>,
    host,
  )
}
