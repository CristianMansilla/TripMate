'use client'

import { useEffect, useRef } from 'react'

const focusableSelector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let openModalCount=0
let bodyOverflowBeforeModals=''

export function useModalBehavior<T extends HTMLElement=HTMLDivElement>(onClose:()=>void,active=true){
  const dialogRef=useRef<T>(null)
  const onCloseRef=useRef(onClose)
  onCloseRef.current=onClose
  useEffect(()=>{
    if(!active)return
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
    const dialog=dialogRef.current
    const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) || []).filter(element=>element.getClientRects().length>0 && !element.closest('[hidden]'))
    const handleKeyDown=(event:KeyboardEvent)=>{
      const openDialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
      if(openDialogs.at(-1)!==dialog)return
      if(event.key==='Escape')onCloseRef.current()
      if(event.key!=='Tab')return
      const elements=focusable()
      if(!elements.length){event.preventDefault();dialog?.focus();return}
      const first=elements[0],last=elements[elements.length-1]
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
    const handleFocusIn=(event:FocusEvent)=>{
      const target=event.target
      if(!(target instanceof HTMLElement)||!dialog?.contains(target)||target.closest('.modal-actions'))return
      requestAnimationFrame(()=>{
        if(!target.isConnected)return
        const footer=dialog.querySelector<HTMLElement>('.modal-actions')
        if(!footer)return
        const targetRect=target.getBoundingClientRect()
        const dialogRect=dialog.getBoundingClientRect()
        const footerRect=footer.getBoundingClientRect()
        if(targetRect.top<dialogRect.top+12||targetRect.bottom>footerRect.top-12){
          target.scrollIntoView({block:'center',inline:'nearest'})
        }
      })
    }
    if(openModalCount===0){
      bodyOverflowBeforeModals=document.body.style.overflow
      document.body.style.overflow='hidden'
    }
    openModalCount+=1
    document.addEventListener('keydown',handleKeyDown)
    dialog?.addEventListener('focusin',handleFocusIn)
    requestAnimationFrame(()=>{
      const preferred=dialog?.querySelector<HTMLElement>('[autofocus]')
      ;(preferred || focusable()[0] || dialog)?.focus()
    })
    return()=>{
      openModalCount=Math.max(0,openModalCount-1)
      if(openModalCount===0)document.body.style.overflow=bodyOverflowBeforeModals
      document.removeEventListener('keydown',handleKeyDown)
      dialog?.removeEventListener('focusin',handleFocusIn)
      if(previousFocus?.isConnected)previousFocus.focus()
    }
  },[active])
  return dialogRef
}
