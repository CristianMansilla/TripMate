'use client'
import { useEffect, useState } from 'react'
import { Activity, Expense } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'

type ExpenseDraft = Expense & {
}

export default function ExpenseModal({expense,activities,onClose,onSave,onDelete,categoryOptions=[]}:{expense:Expense,activities:Activity[],onClose:()=>void,onSave:(expense:ExpenseDraft)=>Promise<void>|void,onDelete?:(expense:Expense)=>void,categoryOptions?:string[]}){
  useModalBehavior(onClose)
  const linkedActivity=activities.find(activity=>activity.id===expense.activityId)
  const withSchedule=(value:Expense):ExpenseDraft=>({...value,date:value.date || linkedActivity?.date || '',startTime:value.startTime || linkedActivity?.startTime || '',endTime:value.endTime || linkedActivity?.endTime || '',place:value.place || linkedActivity?.place || '',notes:value.notes || linkedActivity?.notes || '',optional:value.optional ?? Boolean(linkedActivity?.optional),amountBasis:value.amountBasis || 'per_person'})
  const [draft,setDraft]=useState<ExpenseDraft>(withSchedule(expense))
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>setDraft(withSchedule(expense)),[expense,linkedActivity])
  const patch=(key:keyof ExpenseDraft,value:any)=>setDraft(current=>({...current,[key]:value}))

  async function submit(event:React.FormEvent){
    event.preventDefault()
    setMessage('')
    if(!draft.title.trim()){setMessage('El nombre no puede estar vacío.');return}
    if(!Number.isFinite(draft.amount) || draft.amount<0){setMessage('El importe debe ser cero o mayor.');return}
    setLoading(true)
    try{await onSave({...draft,title:draft.title.trim(),category:draft.category.trim()})}
    catch(error){setMessage(userFacingError(error,'No pudimos guardar el gasto. Intentá nuevamente.'))}
    finally{setLoading(false)}
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onSubmit={submit} noValidate>
      <h2 id="expense-modal-title">Editar gasto</h2>
      {message&&<div className="notice error">{message}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="expense-title">Nombre</label><input id="expense-title" value={draft.title} onChange={e=>patch('title',e.target.value)} required/></div>
        <CategoryPicker value={draft.category} options={categoryOptions} onChange={value=>patch('category',value)} required/>
        <div className="field"><label htmlFor="expense-amount">{draft.amountBasis==='group'?'Importe total del servicio':'Importe por persona'}</label><input id="expense-amount" type="number" min="0" step="0.01" value={draft.amount} onChange={e=>patch('amount',Number(e.target.value))} required/></div>
        <div className="field"><label htmlFor="expense-basis">El importe corresponde a</label><select id="expense-basis" value={draft.amountBasis || 'per_person'} onChange={e=>patch('amountBasis',e.target.value)}><option value="per_person">Cada persona</option><option value="group">Todo el grupo o servicio</option></select></div>
        <div className="field"><label htmlFor="expense-date">Día en itinerario</label><input id="expense-date" type="date" value={draft.date || ''} onChange={e=>patch('date',e.target.value)}/></div>
        <div className="field"><label htmlFor="expense-place">Lugar</label><input id="expense-place" value={draft.place || ''} onChange={e=>patch('place',e.target.value)} placeholder="Terminal, hotel, restaurante..."/></div>
        <div className="field"><label htmlFor="expense-start">Desde</label><input id="expense-start" type="time" value={draft.startTime || ''} onChange={e=>patch('startTime',e.target.value)}/></div>
        <div className="field"><label htmlFor="expense-end">Hasta</label><input id="expense-end" type="time" value={draft.endTime || ''} onChange={e=>patch('endTime',e.target.value)}/></div>
        <div className="field"><label htmlFor="expense-status">Estado</label><select id="expense-status" value={draft.status} onChange={e=>patch('status',e.target.value)}>
          <option value="estimated">Estimado</option>
          <option value="confirmed">Confirmado</option>
          <option value="paid">Pagado</option>
        </select></div>
        <label className="toggle-field">
          <input type="checkbox" checked={draft.included!==false} onChange={e=>patch('included',e.target.checked)}/>
          <span>
            <b>Incluir en el total</b>
            <small>Puede formar parte del presupuesto aunque todavía no tenga día en el itinerario.</small>
          </span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(draft.optional)} onChange={e=>patch('optional',e.target.checked)}/>
          <span>
            <b>Actividad opcional</b>
            <small>Se muestra en el itinerario como plan tentativo o alternativa para ese horario.</small>
          </span>
        </label>
        <div className="field full"><label htmlFor="expense-notes">Notas</label><textarea id="expense-notes" value={draft.notes || ''} onChange={e=>patch('notes',e.target.value)} placeholder="Detalle para el itinerario"/></div>
      </div>
      <div className="modal-actions split">
        {onDelete&&<button type="button" className="btn btn-danger" onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>}
        <span/>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar cambios'}</button>
      </div>
    </form>
  </div>
}
