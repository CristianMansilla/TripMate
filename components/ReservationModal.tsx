'use client'

import { FormEvent, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Reservation } from '@/lib/types'
import { userFacingError } from '@/lib/ui-text'
import { useModalBehavior } from './useModalBehavior'

export default function ReservationModal({reservation,onClose,onSave,onDelete}:{
  reservation:Reservation
  onClose:()=>void
  onSave:(reservation:Reservation)=>Promise<void>|void
  onDelete:(reservation:Reservation)=>void
}){
  useModalBehavior(onClose)
  const [draft,setDraft]=useState(reservation)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const patch=<K extends keyof Reservation>(key:K,value:Reservation[K])=>setDraft(current=>({...current,[key]:value}))

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    const title=draft.title.trim()
    if(!title){setMessage('El nombre no puede estar vacío.');return}
    if(draft.amount!==undefined && (!Number.isFinite(draft.amount) || draft.amount<0)){setMessage('El importe debe ser cero o mayor.');return}
    setLoading(true)
    try{await onSave({...draft,title,notes:draft.notes?.trim() || undefined})}
    catch(error){setMessage(userFacingError(error,'No pudimos guardar la reserva. Intentá nuevamente.'))}
    finally{setLoading(false)}
  }

  return <div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)onClose()}}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title" onSubmit={submit}>
      <h2 id="reservation-modal-title">Editar reserva</h2>
      {message&&<div className="notice error" role="alert">{message}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="reservation-title">Nombre</label><input id="reservation-title" value={draft.title} onChange={event=>patch('title',event.target.value)} required autoFocus/></div>
        <div className="field"><label htmlFor="reservation-status">Estado</label><select id="reservation-status" value={draft.status} onChange={event=>patch('status',event.target.value as Reservation['status'])}><option value="watching">Esperando</option><option value="pending">Pendiente</option><option value="reserved">Reservado</option><option value="paid">Pagado</option></select></div>
        <div className="field"><label htmlFor="reservation-priority">Prioridad</label><select id="reservation-priority" value={draft.priority} onChange={event=>patch('priority',event.target.value as Reservation['priority'])}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div>
        <div className="field"><label htmlFor="reservation-due-date">Fecha límite</label><input id="reservation-due-date" type="date" value={draft.dueDate || ''} onChange={event=>patch('dueDate',event.target.value || undefined)}/></div>
        <div className="field"><label htmlFor="reservation-amount">Importe por persona</label><input id="reservation-amount" type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={event=>patch('amount',event.target.value===''?undefined:Number(event.target.value))}/></div>
        <div className="field full"><label htmlFor="reservation-notes">Notas</label><textarea id="reservation-notes" value={draft.notes || ''} onChange={event=>patch('notes',event.target.value)} placeholder="Condiciones, contacto o recordatorios"/></div>
      </div>
      <div className="modal-actions split">
        <button type="button" className="btn btn-danger" onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>
        <span/>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar cambios'}</button>
      </div>
    </form>
  </div>
}
