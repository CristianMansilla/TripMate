'use client'

import { useEffect } from 'react'

export function useModalBehavior(onClose:()=>void){
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose()
    }
    document.body.style.overflow='hidden'
    document.addEventListener('keydown',closeOnEscape)
    return()=>{
      document.body.style.overflow=previousOverflow
      document.removeEventListener('keydown',closeOnEscape)
    }
  },[onClose])
}
