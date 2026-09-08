'use client'
import { useEffect, useState } from 'react'
import { Activity, Expense } from '@/lib/types'
import { CalendarDays, Trash2, WalletCards } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import ExpenseOccurrencesEditor from './ExpenseOccurrencesEditor'
import Snackbar from './Snackbar'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'
import { useSubmissionGuard } from './useSubmissionGuard'

type ExpenseDraft = Expense & {
}

export default function ExpenseModal({expense,activities,onClose,onSave,onDelete,categoryOptions=[],minDate,maxDate}:{expense:Expense,activities:Activity[],onClose:()=>void,onSave:(expense:ExpenseDraft)=>Promise<void>|void,onDelete?:(expense:Expense)=>void,categoryOptions?:string[],minDate?:string,maxDate?:string}){
  const dialogRef=useModalBehavior<HTMLFormElement>(onClose)
  const linkedActivities=activities.filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId)
  const linkedActivity=linkedActivities[0]
  const withSchedule=(value:Expense):ExpenseDraft=>({...value,occurrences:value.occurrences?.length?value.occurrences:linkedActivities.length?linkedActivities.map(activity=>({id:activity.id,date:activity.date,startTime:activity.startTime,endTime:activity.endTime,steps:activity.steps || []})):value.date?[{id:value.activityId || undefined,date:value.date,startTime:value.startTime,endTime:value.endTime,steps:linkedActivity?.steps || []}]:[],place:value.place || linkedActivity?.place || '',notes:value.notes || linkedActivity?.notes || '',optional:value.optional ?? Boolean(linkedActivity?.optional),amountBasis:value.amountBasis || 'per_person',occurrencePricing:value.occurrencePricing || 'total'})
  const [draft,setDraft]=useState<ExpenseDraft>(withSchedule(expense))
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const [activeTab,setActiveTab]=useState<'main'|'itinerary'>('main')
  const runOnce=useSubmissionGuard()
  useEffect(()=>setDraft(withSchedule(expense)),[expense,activities])
  const patch=(key:keyof ExpenseDraft,value:any)=>setDraft(current=>({...current,[key]:value}))
  const steps=(draft.occurrences || []).flatMap(item=>item.steps || [])
  const hasSteps=steps.length>0
  const stepsTotal=steps.reduce((sum,step)=>sum+(Number.isFinite(step.amount)?step.amount:0),0)

  async function submit(event:React.FormEvent){
    event.preventDefault()
    setMessage('')
    if(!draft.title.trim()){setActiveTab('main');setMessage('El nombre no puede estar vacío.');return}
    if(!Number.isFinite(hasSteps?stepsTotal:draft.amount) || (hasSteps?stepsTotal:draft.amount)<0){setActiveTab('main');setMessage('El importe debe ser cero o mayor.');return}
    if((draft.occurrences || []).some(item=>!item.date)){setActiveTab('itinerary');setMessage('Completá o quitá los días vacíos del itinerario.');return}
    if((draft.occurrences || []).some(item=>(minDate && item.date<minDate) || (maxDate && item.date>maxDate))){setActiveTab('itinerary');setMessage('Los días del itinerario deben estar dentro de las fechas del viaje.');return}
    if((draft.occurrences || []).some(item=>(item.steps || []).some(step=>!step.title.trim()))){setActiveTab('itinerary');setMessage('Completá o quitá las subactividades que no tienen nombre.');return}
    if(steps.some(step=>!Number.isFinite(step.amount) || step.amount<0)){setActiveTab('itinerary');setMessage('Los importes de las subactividades deben ser cero o mayores.');return}
    await runOnce(async()=>{
      setLoading(true)
      try{await onSave({...draft,title:draft.title.trim(),category:draft.category.trim(),amount:hasSteps?stepsTotal:draft.amount,occurrencePricing:hasSteps?'total':draft.occurrencePricing})}
      catch(error){setMessage(userFacingError(error,'No pudimos guardar el gasto. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <form ref={dialogRef} className="modal expense-modal sticky-actions-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" tabIndex={-1} onSubmit={submit} noValidate>
      <h2 id="expense-modal-title">Editar gasto</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="expense-form-tabs" role="tablist" aria-label="Secciones del gasto">
        <button type="button" role="tab" aria-selected={activeTab==='main'} className={activeTab==='main'?'active':''} onClick={()=>setActiveTab('main')}><WalletCards size={17}/> Datos y presupuesto</button>
        <button type="button" role="tab" aria-selected={activeTab==='itinerary'} className={activeTab==='itinerary'?'active':''} onClick={()=>setActiveTab('itinerary')}><CalendarDays size={17}/> Itinerario{(draft.occurrences?.length || 0)>0?` (${draft.occurrences?.length})`:''}</button>
      </div>
      <div className="form-grid">
        <section className="expense-form-section full" role="tabpanel" hidden={activeTab!=='main'} aria-labelledby="expense-main-section">
          <div className="expense-section-head"><div><h3 id="expense-main-section">Actividad principal</h3><small>Datos comunes a todo el bloque</small></div>{hasSteps&&<div className="expense-derived-total"><span>{draft.amountBasis==='group'?'Total del grupo':'Total por persona'}</span><strong>{stepsTotal.toLocaleString('es-AR',{maximumFractionDigits:2})}</strong></div>}</div>
          <div className="expense-section-grid">
            <div className="field full"><label htmlFor="expense-title">Nombre de la actividad principal</label><input id="expense-title" value={draft.title} onChange={e=>patch('title',e.target.value)} required/></div>
            <CategoryPicker label="Categoría principal" value={draft.category} options={categoryOptions} onChange={value=>patch('category',value)} required/>
            {!hasSteps&&<div className="field"><label htmlFor="expense-amount">{draft.amountBasis==='group'?'Importe total del servicio':'Importe por persona'}</label><input id="expense-amount" type="number" min="0" step="0.01" value={Number.isNaN(draft.amount)?'':draft.amount} onChange={e=>patch('amount',e.target.value===''?Number.NaN:Number(e.target.value))} required/></div>}
            <div className="field"><label htmlFor="expense-basis">Los importes corresponden a</label><select id="expense-basis" value={draft.amountBasis || 'per_person'} onChange={e=>patch('amountBasis',e.target.value)}><option value="per_person">Cada persona</option><option value="group">Todo el grupo o servicio</option></select></div>
            <div className="field"><label htmlFor="expense-place">Lugar principal</label><input id="expense-place" value={draft.place || ''} onChange={e=>patch('place',e.target.value)} placeholder="Zona o punto de encuentro general"/></div>
          </div>
        </section>
        <section className="expense-form-section full" role="tabpanel" hidden={activeTab!=='itinerary'} aria-labelledby="expense-agenda-section">
          <div className="expense-section-head"><div><h3 id="expense-agenda-section">Itinerario y subactividades</h3><small>Horario general y detalle de cada subactividad</small></div></div>
          <ExpenseOccurrencesEditor idPrefix="expense" value={draft.occurrences || []} onChange={value=>patch('occurrences',value)} minDate={minDate} maxDate={maxDate}/>
        </section>
        <section className="expense-form-section full" hidden={activeTab!=='main'} aria-labelledby="expense-details-section">
          <div className="expense-section-head"><h3 id="expense-details-section">Presupuesto y detalles</h3></div>
          <div className="expense-section-grid">
            {(draft.occurrences?.length || 0)>1&&!hasSteps&&<div className="field full"><label htmlFor="expense-occurrence-pricing">Cómo se calcula en días repetidos</label><select id="expense-occurrence-pricing" value={draft.occurrencePricing || 'total'} onChange={e=>patch('occurrencePricing',e.target.value)}><option value="total">El importe es el total de todos los días</option><option value="per_occurrence">El importe se cobra por cada día</option></select></div>}
            <div className="field"><label htmlFor="expense-status">Estado</label><select id="expense-status" value={draft.status} onChange={e=>patch('status',e.target.value)}>
              <option value="estimated">Estimado</option>
              <option value="confirmed">Confirmado</option>
              <option value="paid">Pagado</option>
            </select></div>
            <label className="toggle-field">
              <input type="checkbox" checked={draft.included!==false} onChange={e=>patch('included',e.target.checked)}/>
              <span><b>Incluir en el total</b><small>Puede formar parte del presupuesto aunque todavía no tenga día.</small></span>
            </label>
            <label className="toggle-field">
              <input type="checkbox" checked={Boolean(draft.optional)} onChange={e=>patch('optional',e.target.checked)}/>
              <span><b>Actividad opcional</b><small>Se muestra como plan tentativo en el itinerario.</small></span>
            </label>
            <div className="field full"><label htmlFor="expense-notes">Notas generales</label><textarea id="expense-notes" value={draft.notes || ''} onChange={e=>patch('notes',e.target.value)} placeholder="Información común a toda la actividad"/></div>
          </div>
        </section>
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
