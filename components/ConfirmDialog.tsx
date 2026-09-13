'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'
import ModalCloseButton from './ModalCloseButton'
import { LoaderCircle } from 'lucide-react'
import ModalBusyOverlay from './ModalBusyOverlay'

export default function ConfirmDialog({title,children,confirmLabel,confirmIcon,onClose,onConfirm}:{
  title:string
  children:ReactNode
  confirmLabel:string
  confirmIcon?:ReactNode
  onClose:()=>void
  onConfirm:()=>Promise<void>|void
}){
  const runOnce=useSubmissionGuard()
  const [loading,setLoading]=useState(false)
  const requestClose=()=>{if(!loading)onClose()}
  const dialogRef=useModalBehavior<HTMLDivElement>(requestClose)
  const titleId=`confirm-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
  async function confirm(){
    await runOnce(async()=>{
      setLoading(true)
      try{await onConfirm()}finally{setLoading(false)}
    })
  }
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}>
    <div ref={dialogRef} className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={loading} tabIndex={-1}>
      <ModalCloseButton onClick={requestClose} disabled={loading}/>
      <h2 id={titleId}>{title}</h2>
      <div className="muted">{children}</div>
      <div className="modal-actions">
        <button type="button" className="btn btn-danger" onClick={confirm} disabled={loading}>{loading?<LoaderCircle className="button-spinner" size={16}/>:confirmIcon}{loading?'Procesando…':confirmLabel}</button>
      </div>
    </div>
    <ModalBusyOverlay active={loading}/>
  </div>
}
