'use client'

import { FormEvent, useState } from 'react'
import { Link2 } from 'lucide-react'
import { normalizeAttachmentUrl } from '@/lib/trip-item-attachments'
import ModalCloseButton from './ModalCloseButton'
import { useModalBehavior } from './useModalBehavior'

export default function TripItemAttachmentLinkModal({onClose,onAdd}:{
  onClose:()=>void
  onAdd:(input:{fileName:string;externalUrl:string})=>Promise<boolean>
}){
  const [fileName,setFileName]=useState('')
  const [externalUrl,setExternalUrl]=useState('')
  const [message,setMessage]=useState('')
  const dialogRef=useModalBehavior<HTMLFormElement>(onClose)

  async function submit(event:FormEvent){
    event.preventDefault()
    const name=fileName.trim()
    const url=normalizeAttachmentUrl(externalUrl)
    if(!name){setMessage('Ingresá un nombre para identificar el enlace.');return}
    if(!url){setMessage('Ingresá un enlace seguro que comience con https://.');return}
    setMessage('')
    if(await onAdd({fileName:name,externalUrl:url}))onClose()
  }

  return <div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)onClose()}}>
    <form ref={dialogRef} className="modal confirm-modal reservation-document-modal" role="dialog" aria-modal="true" aria-labelledby="attachment-link-title" tabIndex={-1} onSubmit={submit}>
      <ModalCloseButton onClick={onClose}/>
      <h2 id="attachment-link-title">Agregar enlace</h2>
      <div className="field"><label htmlFor="attachment-link-name">Nombre</label><input id="attachment-link-name" value={fileName} maxLength={255} onChange={event=>{setFileName(event.target.value);setMessage('')}} placeholder="Pasaje, entrada o comprobante" autoFocus/></div>
      <div className="field"><label htmlFor="attachment-link-url">Enlace</label><input id="attachment-link-url" type="url" inputMode="url" value={externalUrl} onChange={event=>{setExternalUrl(event.target.value);setMessage('')}} placeholder="https://..."/></div>
      {message&&<div className="field-error" role="alert">{message}</div>}
      <div className="modal-actions"><button className="btn btn-primary"><Link2 size={16}/> Agregar enlace</button></div>
    </form>
  </div>
}
