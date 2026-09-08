'use client'
import { FormEvent, useState } from 'react'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'
import { useSubmissionGuard } from './useSubmissionGuard'
import ExpenseOccurrencesEditor from './ExpenseOccurrencesEditor'
import { ExpenseOccurrence } from '@/lib/types'
import Snackbar from './Snackbar'
import { CalendarDays, WalletCards } from 'lucide-react'
import DiscardChangesDialog from './DiscardChangesDialog'
import { useDiscardConfirmation } from './useDiscardConfirmation'

type Kind='expense'|'reservation'|'packing'|'place'

function validExternalUrl(value:string){
  if(!value)return true
  try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}
}

export default function QuickAddModal({kind,onClose,onSave,categoryOptions=[],minDate,maxDate}:{kind:Kind,onClose:()=>void,onSave:(payload:any)=>Promise<void>|void,categoryOptions?:string[],minDate?:string,maxDate?:string}){
  const initialCategory=categoryOptions[0] || (kind==='packing'?'General':kind==='expense'?'Otros':'')
  const [title,setTitle]=useState('')
  const [amount,setAmount]=useState('')
  const [amountBasis,setAmountBasis]=useState<'per_person'|'group'>('per_person')
  const [category,setCategory]=useState(initialCategory)
  const [occurrences,setOccurrences]=useState<ExpenseOccurrence[]>([])
  const [occurrencePricing,setOccurrencePricing]=useState<'total'|'per_occurrence'>('total')
  const [place,setPlace]=useState('')
  const [optional,setOptional]=useState(false)
  const [included,setIncluded]=useState(true)
  const [priority,setPriority]=useState('medium')
  const [dueDate,setDueDate]=useState('')
  const [address,setAddress]=useState('')
  const [url,setUrl]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const [activeExpenseTab,setActiveExpenseTab]=useState<'main'|'itinerary'>('main')
  const runOnce=useSubmissionGuard()
  const isDirty=Boolean(title || amount || amountBasis!=='per_person' || category!==initialCategory || occurrences.length || occurrencePricing!=='total' || place || optional || !included || priority!=='medium' || dueDate || address || url || notes)
  const discard=useDiscardConfirmation(isDirty,onClose,loading)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)
  const labels={expense:'Nuevo gasto',reservation:'Nueva reserva',packing:'Agregar a valija',place:'Nuevo lugar'} as const
  const steps=occurrences.flatMap(item=>item.steps || [])
  const stepsTotal=steps.reduce((sum,step)=>sum+(Number.isFinite(step.amount)?step.amount:0),0)
  async function submit(e:FormEvent){
    e.preventDefault();setMessage('')
    if(!title.trim()){if(kind==='expense')setActiveExpenseTab('main');setMessage(kind==='packing'?'El ítem no puede estar vacío.':'El nombre no puede estar vacío.');return}
    if(kind==='expense' && (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount)<0)){setActiveExpenseTab('main');setMessage('El importe debe ser cero o mayor.');return}
    if(kind==='reservation' && amount.trim() && (!Number.isFinite(Number(amount)) || Number(amount)<0)){setMessage('El importe debe ser cero o mayor.');return}
    if(kind==='place' && !validExternalUrl(url.trim())){setMessage('El enlace debe comenzar con http:// o https://.');return}
    if(kind==='expense' && occurrences.some(item=>!item.date)){setActiveExpenseTab('itinerary');setMessage('Completá o quitá los días vacíos del itinerario.');return}
    if(kind==='expense' && occurrences.some(item=>(minDate && item.date<minDate) || (maxDate && item.date>maxDate))){setActiveExpenseTab('itinerary');setMessage('Los días del itinerario deben estar dentro de las fechas del viaje.');return}
    if(kind==='expense' && occurrences.some(item=>(item.steps || []).some(step=>!step.title.trim()))){setActiveExpenseTab('itinerary');setMessage('Completá o quitá las paradas que no tienen nombre.');return}
    if(kind==='expense' && steps.some(step=>!Number.isFinite(step.amount) || step.amount<0)){setActiveExpenseTab('itinerary');setMessage('Los importes de las paradas deben ser cero o mayores.');return}
    await runOnce(async()=>{
      setLoading(true)
      try{
        await onSave({title:title.trim(),amount:amount.trim()===''?undefined:Number(amount),amountBasis,category:category.trim(),priority,dueDate,address,url,notes,occurrences,occurrencePricing,place,optional,included})
        onClose()
      }catch(error){setMessage(userFacingError(error,'No pudimos guardar. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }
  return <><div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)discard.requestClose()}}>
    <form ref={dialogRef} className={`modal sticky-actions-modal ${kind==='expense'?'expense-modal':''}`} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" tabIndex={-1} onSubmit={submit} noValidate>
      <h2 id="quick-add-title">{labels[kind]}</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="form-grid">
        {kind!=='expense'&&<div className="field full"><label htmlFor="quick-title">{kind==='packing'?'Ítem':'Nombre'}</label><input id="quick-title" value={title} onChange={e=>setTitle(e.target.value)} required/></div>}
        {kind==='expense'&&<>
          <div className="expense-form-tabs full" role="tablist" aria-label="Secciones del gasto">
            <button type="button" role="tab" aria-selected={activeExpenseTab==='main'} className={activeExpenseTab==='main'?'active':''} onClick={()=>setActiveExpenseTab('main')}><WalletCards size={17}/> Datos y presupuesto</button>
            <button type="button" role="tab" aria-selected={activeExpenseTab==='itinerary'} className={activeExpenseTab==='itinerary'?'active':''} onClick={()=>setActiveExpenseTab('itinerary')}><CalendarDays size={17}/> Itinerario{occurrences.length?` (${occurrences.length})`:''}</button>
          </div>
          <section className="expense-form-section full" role="tabpanel" hidden={activeExpenseTab!=='main'} aria-labelledby="quick-main-section">
            <div className="expense-section-head"><div><h3 id="quick-main-section">Actividad principal</h3><small>Datos comunes a todo el bloque</small></div>{steps.length>0&&<div className="expense-derived-total"><span>Subtotal informativo de paradas</span><strong>{stepsTotal.toLocaleString('es-AR',{maximumFractionDigits:2})}</strong></div>}</div>
            <div className="expense-section-grid">
              <div className="field full"><label htmlFor="quick-title">Nombre de la actividad principal</label><input id="quick-title" value={title} onChange={e=>setTitle(e.target.value)} required/></div>
              <CategoryPicker label="Categoría principal" value={category} options={categoryOptions} onChange={setCategory} required/>
              <div className="field"><label htmlFor="quick-amount">{amountBasis==='group'?'Costo principal del grupo':'Costo principal'}</label><input id="quick-amount" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
              <label className="toggle-field"><input type="checkbox" checked={amountBasis==='group'} onChange={e=>setAmountBasis(e.target.checked?'group':'per_person')}/><span><b>Precio para todo el grupo</b><small>Usalo sólo cuando el servicio tenga un único precio total.</small></span></label>
              <div className="field"><label htmlFor="quick-place">Lugar principal</label><input id="quick-place" value={place} onChange={e=>setPlace(e.target.value)} placeholder="Zona o punto de encuentro general"/></div>
            </div>
          </section>
          <section className="expense-form-section full" role="tabpanel" hidden={activeExpenseTab!=='itinerary'} aria-labelledby="quick-agenda-section">
            <div className="expense-section-head"><div><h3 id="quick-agenda-section">Itinerario y paradas</h3><small>Horario general y paradas opcionales de la actividad</small></div></div>
            <ExpenseOccurrencesEditor idPrefix="quick-expense" value={occurrences} onChange={setOccurrences} minDate={minDate} maxDate={maxDate} amountBasis={amountBasis}/>
          </section>
          <section className="expense-form-section full" hidden={activeExpenseTab!=='main'} aria-labelledby="quick-details-section">
            <div className="expense-section-head"><h3 id="quick-details-section">Presupuesto y detalles</h3></div>
            <div className="expense-section-grid">
              {occurrences.length>1&&<div className="field full"><label htmlFor="quick-occurrence-pricing">Cómo se calcula en días repetidos</label><select id="quick-occurrence-pricing" value={occurrencePricing} onChange={e=>setOccurrencePricing(e.target.value as 'total'|'per_occurrence')}><option value="total">El importe es el total de todos los días</option><option value="per_occurrence">El importe se cobra por cada día</option></select></div>}
              <label className="toggle-field full">
                <input type="checkbox" checked={included} onChange={e=>setIncluded(e.target.checked)}/>
                <span><b>Incluir en el presupuesto</b><small>Podés excluir el costo sin quitar la actividad de la agenda.</small></span>
              </label>
              <label className="toggle-field full">
                <input type="checkbox" checked={optional} onChange={e=>setOptional(e.target.checked)}/>
                <span><b>Actividad opcional</b><small>Se muestra como plan tentativo en el itinerario.</small></span>
              </label>
              <div className="field full"><label htmlFor="quick-notes">Notas generales</label><textarea id="quick-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Información común a toda la actividad"/></div>
            </div>
          </section>
        </>}
        {kind==='reservation'&&<>
          <div className="field"><label htmlFor="quick-priority">Prioridad</label><select id="quick-priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div>
          <div className="field"><label htmlFor="quick-reservation-due">Fecha límite</label><input id="quick-reservation-due" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
          <div className="field"><label htmlFor="quick-reservation-amount">Importe (opcional)</label><input id="quick-reservation-amount" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <div className="field full"><label htmlFor="quick-reservation-notes">Notas</label><textarea id="quick-reservation-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Condiciones, contacto o recordatorios"/></div>
        </>}
        {kind==='packing'&&<CategoryPicker className="full" value={category} options={categoryOptions} onChange={setCategory}/>}
        {kind==='place'&&<>
          <CategoryPicker value={category} options={categoryOptions} onChange={setCategory} required/>
          <div className="field"><label htmlFor="quick-address">Dirección</label><input id="quick-address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección o zona"/></div>
          <div className="field full"><label htmlFor="quick-url">Link</label><input id="quick-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></div>
          <div className="field full"><label htmlFor="quick-place-notes">Notas</label><textarea id="quick-place-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Horarios, referencias, recomendaciones..."/></div>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar'}</button></div>
    </form>
  </div>{discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
