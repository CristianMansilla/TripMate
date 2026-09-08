'use client'

import { FormEvent, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Expense, Reservation, ReservationCostChoice, ReservationSaveInput } from '@/lib/types'
import { userFacingError } from '@/lib/ui-text'
import Snackbar from './Snackbar'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'
import DiscardChangesDialog from './DiscardChangesDialog'
import { useDiscardConfirmation } from './useDiscardConfirmation'
import ReservationCostFields, { ReservationCostMode } from './ReservationCostFields'

export default function ReservationModal({reservation,expenses,currency,onClose,onSave,onDelete}:{
  reservation:Reservation
  expenses:Expense[]
  currency:string
  onClose:()=>void
  onSave:(input:ReservationSaveInput)=>Promise<void>|void
  onDelete:(reservation:Reservation)=>void
}){
  const [draft,setDraft]=useState(reservation)
  const initialMode:ReservationCostMode=reservation.expenseId?'existing':reservation.amount!==undefined?'legacy':'none'
  const [costMode,setCostMode]=useState<ReservationCostMode>(initialMode)
  const [expenseId,setExpenseId]=useState(reservation.expenseId || '')
  const [newExpenseAmount,setNewExpenseAmount]=useState(reservation.amount===undefined?'':String(reservation.amount))
  const [newExpenseBasis,setNewExpenseBasis]=useState<'per_person'|'group'>('per_person')
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const runOnce=useSubmissionGuard()
  const costSelectionDirty=costMode!==initialMode
  const newCostDirty=costMode==='new' && (newExpenseAmount!==String(reservation.amount ?? '') || newExpenseBasis!=='per_person')
  const costDirty=costSelectionDirty || expenseId!==(reservation.expenseId || '') || newCostDirty
  const discard=useDiscardConfirmation(JSON.stringify(draft)!==JSON.stringify(reservation) || costDirty,onClose,loading)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)
  const patch=<K extends keyof Reservation>(key:K,value:Reservation[K])=>setDraft(current=>({...current,[key]:value}))

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    const title=draft.title.trim()
    if(!title){setMessage('El nombre no puede estar vacío.');return}
    if(costMode==='existing' && !expenseId){setMessage('Elegí el gasto que corresponde a esta reserva.');return}
    const parsedAmount=Number(newExpenseAmount)
    if(costMode==='new' && (!newExpenseAmount.trim() || !Number.isFinite(parsedAmount) || parsedAmount<0)){setMessage('El costo debe ser cero o mayor.');return}
    const cost:ReservationCostChoice=costMode==='existing'
      ? {mode:'existing',expenseId}
      : costMode==='new'
        ? {mode:'new',amount:parsedAmount,amountBasis:newExpenseBasis}
        : costMode==='legacy' && reservation.amount!==undefined
          ? {mode:'legacy',amount:reservation.amount}
          : {mode:'none'}
    await runOnce(async()=>{
      setLoading(true)
      try{await onSave({reservation:{...draft,title,notes:draft.notes?.trim() || undefined},cost})}
      catch(error){setMessage(userFacingError(error,'No pudimos guardar la reserva. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  return <><div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)discard.requestClose()}}>
    <form ref={dialogRef} className="modal sticky-actions-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title" tabIndex={-1} onSubmit={submit}>
      <h2 id="reservation-modal-title">Editar reserva</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="form-grid">
        <div className="field full"><label htmlFor="reservation-title">Nombre</label><input id="reservation-title" value={draft.title} onChange={event=>patch('title',event.target.value)} required/></div>
        <div className="field"><label htmlFor="reservation-status">Estado de la reserva</label><select id="reservation-status" value={draft.status} onChange={event=>patch('status',event.target.value as Reservation['status'])}><option value="watching">Esperando</option><option value="pending">Pendiente</option><option value="reserved">Reservado</option><option value="paid">Pagado</option></select></div>
        <div className="field"><label htmlFor="reservation-priority">Prioridad</label><select id="reservation-priority" value={draft.priority} onChange={event=>patch('priority',event.target.value as Reservation['priority'])}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div>
        <div className="field"><label htmlFor="reservation-due-date">Fecha límite</label><input id="reservation-due-date" type="date" value={draft.dueDate || ''} onChange={event=>patch('dueDate',event.target.value || undefined)}/></div>
        <ReservationCostFields mode={costMode} expenseId={expenseId} amount={newExpenseAmount} amountBasis={newExpenseBasis} expenses={expenses} currency={currency} legacyAmount={reservation.amount} onModeChange={setCostMode} onExpenseChange={setExpenseId} onAmountChange={setNewExpenseAmount} onAmountBasisChange={setNewExpenseBasis}/>
        <div className="field full"><label htmlFor="reservation-notes">Notas</label><textarea id="reservation-notes" value={draft.notes || ''} onChange={event=>patch('notes',event.target.value)} placeholder="Condiciones, contacto o recordatorios"/></div>
      </div>
      <div className="modal-actions split">
        <button type="button" className="btn btn-danger" disabled={loading} onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>
        <span/>
        <button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar cambios'}</button>
      </div>
    </form>
  </div>{discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
