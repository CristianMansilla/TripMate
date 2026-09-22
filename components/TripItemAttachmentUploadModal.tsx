'use client'

import { FormEvent, useMemo, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import ModalCloseButton from './ModalCloseButton'
import { useModalBehavior } from './useModalBehavior'

const ALL_TRAVELERS='__all__'
const OTHER_TRAVELER='__other__'

export default function TripItemAttachmentUploadModal({file,travelerNames,onClose,onUpload}:{
  file:File
  travelerNames:string[]
  onClose:()=>void
  onUpload:(passengerLabel:string)=>Promise<boolean>
}){
  const options=useMemo(()=>[...new Set(travelerNames.map(name=>name.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[travelerNames])
  const [selection,setSelection]=useState('')
  const [otherName,setOtherName]=useState('')
  const [message,setMessage]=useState('')
  const dialogRef=useModalBehavior<HTMLFormElement>(onClose)
  const fileSize=file.size>=1024*1024?`${(file.size/(1024*1024)).toLocaleString('es-AR',{maximumFractionDigits:1})} MB`:`${Math.max(1,Math.round(file.size/1024)).toLocaleString('es-AR')} KB`

  async function submit(event:FormEvent){
    event.preventDefault()
    const passengerLabel=selection===ALL_TRAVELERS?'Todos los viajeros':selection===OTHER_TRAVELER?otherName.trim():selection
    if(!passengerLabel){setMessage(selection===OTHER_TRAVELER?'Ingresá el nombre del pasajero.':'Seleccioná a quién corresponde el PDF.');return}
    if(passengerLabel.length>80){setMessage('El nombre del pasajero no puede superar los 80 caracteres.');return}
    setMessage('')
    if(await onUpload(passengerLabel))onClose()
  }

  return <div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)onClose()}}>
    <form ref={dialogRef} className="modal confirm-modal reservation-document-modal" role="dialog" aria-modal="true" aria-labelledby="attachment-upload-title" tabIndex={-1} onSubmit={submit}>
      <ModalCloseButton onClick={onClose}/>
      <h2 id="attachment-upload-title">Adjuntar PDF</h2>
      <div className="document-file-summary"><FileText size={20}/><div><strong>{file.name}</strong><small>{fileSize}</small></div></div>
      <div className="field">
        <label htmlFor="attachment-upload-passenger">Corresponde a</label>
        <select id="attachment-upload-passenger" value={selection} onChange={event=>{setSelection(event.target.value);setMessage('')}} autoFocus required>
          <option value="">Seleccionar pasajero</option>
          {options.map(name=><option value={name} key={name}>{name}</option>)}
          <option value={ALL_TRAVELERS}>Todos los viajeros</option>
          <option value={OTHER_TRAVELER}>Otra persona</option>
        </select>
      </div>
      {selection===OTHER_TRAVELER&&<div className="field"><label htmlFor="attachment-upload-other">Nombre del pasajero</label><input id="attachment-upload-other" value={otherName} maxLength={80} onChange={event=>{setOtherName(event.target.value);setMessage('')}} autoFocus/></div>}
      {message&&<div className="field-error" role="alert">{message}</div>}
      <div className="modal-actions"><button className="btn btn-primary"><Upload size={16}/> Adjuntar</button></div>
    </form>
  </div>
}
