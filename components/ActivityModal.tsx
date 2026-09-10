'use client'

import { FormEvent, useState } from 'react'
import { CircleDollarSign, Trash2 } from 'lucide-react'
import type { Activity } from '@/lib/types'
import { money } from '@/lib/money'
import { userFacingError } from '@/lib/ui-text'
import DiscardChangesDialog from './DiscardChangesDialog'
import ActivityStepsEditor from './ActivityStepsEditor'
import Snackbar from './Snackbar'
import { useDiscardConfirmation } from './useDiscardConfirmation'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'

export type ActivitySaveInput = {
  activity: Activity
  cost: {mode:'none'} | {mode:'new';amount:number;amountBasis:'per_person'|'group'}
}

const categoryOptions:[string,string][]=[
  ['activity','Actividad'],['museum','Museo'],['event','Evento'],['transport','Transporte'],
  ['food','Comida'],['lodging','Alojamiento'],['nightlife','Noche'],['other','Otro'],
]
const standardCategories=new Set(categoryOptions.map(([value])=>value))

export default function ActivityModal({activity,currency,minDate,maxDate,isNew=false,onClose,onSave,onDelete}:{
  activity:Activity
  currency:string
  minDate:string
  maxDate:string
  isNew?:boolean
  onClose:()=>void
  onSave:(input:ActivitySaveInput)=>Promise<void>|void
  onDelete?:(activity:Activity)=>void
}){
  const initialCategoryMode=standardCategories.has(activity.category)?activity.category:'other'
  const initialCustomCategory=initialCategoryMode==='other'&&activity.category!=='other'?activity.category:''
  const [draft,setDraft]=useState(activity)
  const [categoryMode,setCategoryMode]=useState(initialCategoryMode)
  const [customCategory,setCustomCategory]=useState(initialCustomCategory)
  const [addCost,setAddCost]=useState(false)
  const [costAmount,setCostAmount]=useState(activity.estimatedCost>0?String(activity.estimatedCost):'')
  const [groupCost,setGroupCost]=useState(false)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const runOnce=useSubmissionGuard()
  const initial=JSON.stringify({activity,categoryMode:initialCategoryMode,customCategory:initialCustomCategory,addCost:false,costAmount:activity.estimatedCost>0?String(activity.estimatedCost):'',groupCost:false})
  const current=JSON.stringify({activity:draft,categoryMode,customCategory,addCost,costAmount,groupCost})
  const discard=useDiscardConfirmation(current!==initial,onClose,loading)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)
  const patch=<K extends keyof Activity>(key:K,value:Activity[K])=>setDraft(current=>({...current,[key]:value}))

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    const title=draft.title.trim()
    const category=categoryMode==='other'?customCategory.trim() || 'other':categoryMode
    if(!title){setMessage('El nombre no puede estar vacío.');return}
    if(category.length>60){setMessage('El tipo no puede superar los 60 caracteres.');return}
    if(!draft.date){setMessage('Elegí un día para la actividad.');return}
    if(draft.startTime && draft.endTime && draft.endTime<=draft.startTime){setMessage('La hora de fin debe ser posterior a la hora de inicio.');return}
    if((draft.steps || []).some(step=>!step.title.trim())){setMessage('Completá o quitá las paradas que no tienen nombre.');return}
    const amount=Number(costAmount)
    if(addCost && (!costAmount.trim() || !Number.isFinite(amount) || amount<0)){setMessage('El costo debe ser cero o mayor.');return}
    await runOnce(async()=>{
      setLoading(true)
      try{
        await onSave({
          activity:{...draft,title,category,place:draft.place?.trim() || undefined,notes:draft.notes?.trim() || undefined},
          cost:addCost?{mode:'new',amount,amountBasis:groupCost?'group':'per_person'}:{mode:'none'},
        })
      }catch(error){setMessage(userFacingError(error,'No pudimos guardar la actividad. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  return <><div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)discard.requestClose()}}>
    <form ref={dialogRef} className="modal sticky-actions-modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title" tabIndex={-1} onSubmit={submit} noValidate>
      <h2 id="activity-modal-title">{isNew?'Nueva actividad':'Editar actividad'}</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="form-grid">
        <div className="field full"><label htmlFor="activity-title">Nombre</label><input id="activity-title" value={draft.title} onChange={event=>patch('title',event.target.value)} autoFocus required/></div>
        <div className="field"><label htmlFor="activity-date">Día</label><input id="activity-date" type="date" min={minDate} max={maxDate} value={draft.date} onChange={event=>patch('date',event.target.value)} required/></div>
        <div className="field"><label htmlFor="activity-category">Tipo</label><select id="activity-category" value={categoryMode} onChange={event=>{const mode=event.target.value;setCategoryMode(mode);patch('category',mode==='other'?customCategory || 'other':mode)}}>{categoryOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        {categoryMode==='other'&&<div className="field"><label htmlFor="activity-custom-category">Nombre del tipo <span className="optional-label">(opcional)</span></label><input id="activity-custom-category" maxLength={60} value={customCategory} onChange={event=>{setCustomCategory(event.target.value);patch('category',event.target.value || 'other')}} placeholder="Ej. Compras"/></div>}
        <div className="field"><label htmlFor="activity-start">Desde</label><input id="activity-start" type="time" value={draft.startTime || ''} onChange={event=>patch('startTime',event.target.value || undefined)}/></div>
        <div className="field"><label htmlFor="activity-end">Hasta</label><input id="activity-end" type="time" value={draft.endTime || ''} onChange={event=>patch('endTime',event.target.value || undefined)}/></div>
        <div className="field"><label htmlFor="activity-status">Estado</label><select id="activity-status" value={draft.status} onChange={event=>patch('status',event.target.value as Activity['status'])}><option value="idea">Idea</option><option value="planned">Planificado</option><option value="reserved">Reservado</option><option value="done">Hecho</option>{draft.status==='paid'&&<option value="paid">Pagado</option>}</select></div>
        <label className="toggle-field"><input type="checkbox" checked={Boolean(draft.optional)} onChange={event=>patch('optional',event.target.checked)}/><span><b>Actividad opcional</b><small>No es imprescindible para el plan.</small></span></label>
        <div className="field full"><label htmlFor="activity-place">Lugar</label><input id="activity-place" value={draft.place || ''} onChange={event=>patch('place',event.target.value)} placeholder="Dirección, zona o punto de encuentro"/></div>
        <div className="field full"><label htmlFor="activity-notes">Notas</label><textarea id="activity-notes" value={draft.notes || ''} onChange={event=>patch('notes',event.target.value)} placeholder="Información útil para ese momento"/></div>
      </div>

      <section className="expense-form-section">
        <ActivityStepsEditor value={draft.steps || []} onChange={steps=>patch('steps',steps)} idPrefix="activity-step" showAmounts={false}/>
      </section>

      <section className="expense-form-section">
        <label className="toggle-field"><input type="checkbox" checked={addCost} onChange={event=>setAddCost(event.target.checked)}/><CircleDollarSign size={20}/><span><b>Agregar costo a Presupuesto</b><small>Se crea un gasto vinculado y se cuenta una sola vez.</small></span></label>
        {!isNew&&!addCost&&activity.estimatedCost>0&&<div className="field-help">Costo anterior: {money(activity.estimatedCost,currency)}. No está incluido en Presupuesto.</div>}
        {addCost&&<div className="form-grid">
          <div className="field"><label htmlFor="activity-cost">Costo</label><input id="activity-cost" type="number" min="0" step="0.01" value={costAmount} onChange={event=>setCostAmount(event.target.value)} required/></div>
          <label className="toggle-field"><input type="checkbox" checked={groupCost} onChange={event=>setGroupCost(event.target.checked)}/><span><b>Costo del grupo</b><small>Activá esto sólo si el importe no es individual.</small></span></label>
        </div>}
      </section>

      <div className="modal-actions split">
        {!isNew&&onDelete?<button type="button" className="btn btn-danger" disabled={loading} onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>:<span/>}
        <span/>
        <button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':isNew?'Crear actividad':'Guardar cambios'}</button>
      </div>
    </form>
  </div>{discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
