'use client'

import { useEffect, useRef } from 'react'

const focusableSelector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useModalBehavior<T extends HTMLElement=HTMLDivElement>(onClose:()=>void,active=true){
  const dialogRef=useRef<T>(null)
  useEffect(()=>{
    if(!active)return
    const previousOverflow=document.body.style.overflow
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
    const dialog=dialogRef.current
    const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) || [])
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose()
      if(event.key!=='Tab')return
      const elements=focusable()
      if(!elements.length){event.preventDefault();dialog?.focus();return}
      const first=elements[0],last=elements[elements.length-1]
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.body.style.overflow='hidden'
    document.addEventListener('keydown',handleKeyDown)
    requestAnimationFrame(()=>{
      const preferred=dialog?.querySelector<HTMLElement>('[autofocus]')
      ;(preferred || focusable()[0] || dialog)?.focus()
    })
    return()=>{
      document.body.style.overflow=previousOverflow
      document.removeEventListener('keydown',handleKeyDown)
      if(previousFocus?.isConnected)previousFocus.focus()
    }
  },[active,onClose])
  return dialogRef
}
