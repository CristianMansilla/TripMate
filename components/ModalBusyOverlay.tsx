'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export default function ModalBusyOverlay({active,label='Procesando...'}:{active:boolean;label?:string}){
  useEffect(()=>{
    if(!active)return
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur()
    const blockKeyboard=(event:KeyboardEvent)=>{
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown',blockKeyboard,true)
    return()=>document.removeEventListener('keydown',blockKeyboard,true)
  },[active])

  if(!active)return null
  return createPortal(<div className="modal-busy-overlay" role="status" aria-live="polite" aria-label={label}>
    <LoaderCircle aria-hidden="true"/>
    <strong>{label}</strong>
  </div>,document.body)
}
