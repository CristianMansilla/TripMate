'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'

export default function ConfirmDialog({title,children,confirmLabel,confirmIcon,onClose,onConfirm}:{
  title:string
  children:ReactNode
  confirmLabel:string
  confirmIcon?:ReactNode
  onClose:()=>void
  onConfirm:()=>Promise<void>|void
}){
  const dialogRef=useModalBehavior<HTMLDivElement>(onClose)
  const runOnce=useSubmissionGuard()
  const [loading,setLoading]=useState(false)
  const titleId=`confirm-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
  async function confirm(){
    await runOnce(async()=>{
      setLoading(true)
      try{await onConfirm()}finally{setLoading(false)}
    })
  }
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div ref={dialogRef} className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId}>{title}</h2>
      <div className="muted">{children}</div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
        <button className="btn btn-danger" onClick={confirm} disabled={loading}>{confirmIcon}{loading?'Procesando…':confirmLabel}</button>
      </div>
    </div>
  </div>
}
