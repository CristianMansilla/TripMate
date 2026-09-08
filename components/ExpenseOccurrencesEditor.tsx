'use client'

import { ActivityStep, ExpenseOccurrence } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'

function newOccurrence():ExpenseOccurrence{
  return {date:'',startTime:'',endTime:'',steps:[]}
}

function newStep():ActivityStep{
  return {title:'',amount:0,startTime:'',endTime:'',place:'',notes:'',optional:false}
}

export default function ExpenseOccurrencesEditor({value,onChange,minDate,maxDate,idPrefix}:{value:ExpenseOccurrence[],onChange:(value:ExpenseOccurrence[])=>void,minDate?:string,maxDate?:string,idPrefix:string}){
  const patch=(index:number,next:Partial<ExpenseOccurrence>)=>onChange(value.map((item,itemIndex)=>itemIndex===index?{...item,...next}:item))
  const patchStep=(occurrenceIndex:number,stepIndex:number,next:Partial<ActivityStep>)=>{
    const occurrence=value[occurrenceIndex]
    patch(occurrenceIndex,{steps:(occurrence.steps || []).map((step,index)=>index===stepIndex?{...step,...next}:step)})
  }
  return <fieldset className="occurrences-fieldset">
    <legend>Agenda</legend>
    <div className="occurrences-list">
      {value.map((occurrence,index)=><div className="occurrence-card" key={occurrence.id || `new-${index}`}>
        <div className="occurrence-card-head">
          <div><b>Bloque principal</b><span>Día {index+1}</span></div>
          <button type="button" className="icon-btn" onClick={()=>onChange(value.filter((_,itemIndex)=>itemIndex!==index))} title="Quitar día" aria-label={`Quitar día ${index+1}`}><Trash2 size={16}/></button>
        </div>
        <div className="occurrence-row">
          <div className="field occurrence-date"><label htmlFor={`${idPrefix}-date-${index}`}>Fecha del bloque</label><input id={`${idPrefix}-date-${index}`} type="date" min={minDate} max={maxDate} value={occurrence.date} onChange={event=>patch(index,{date:event.target.value})}/></div>
          <div className="field"><label htmlFor={`${idPrefix}-start-${index}`}>Inicio del bloque</label><input id={`${idPrefix}-start-${index}`} type="time" value={occurrence.startTime || ''} onChange={event=>patch(index,{startTime:event.target.value})}/></div>
          <div className="field"><label htmlFor={`${idPrefix}-end-${index}`}>Fin del bloque</label><input id={`${idPrefix}-end-${index}`} type="time" value={occurrence.endTime || ''} onChange={event=>patch(index,{endTime:event.target.value})}/></div>
        </div>
        <div className="steps-editor">
          <div className="steps-editor-head"><div><b>Subactividades del bloque</b><small>{(occurrence.steps || []).length?`${(occurrence.steps || []).length} cargada${(occurrence.steps || []).length===1?'':'s'}`:'Sin subactividades'}</small></div><button type="button" className="btn btn-secondary step-add" onClick={()=>patch(index,{steps:[...(occurrence.steps || []),newStep()]})}><Plus size={15}/> Agregar subactividad</button></div>
          {(occurrence.steps || []).map((step,stepIndex)=><fieldset className="step-editor-row" key={step.id || `new-${index}-${stepIndex}`}>
            <legend>Subactividad {stepIndex+1}</legend>
            <button type="button" className="icon-btn step-remove" onClick={()=>patch(index,{steps:(occurrence.steps || []).filter((_,itemIndex)=>itemIndex!==stepIndex)})} title="Quitar subactividad" aria-label={`Quitar subactividad ${stepIndex+1}`}><Trash2 size={16}/></button>
            <div className="field step-title"><label htmlFor={`${idPrefix}-step-title-${index}-${stepIndex}`}>Nombre de la subactividad</label><input id={`${idPrefix}-step-title-${index}-${stepIndex}`} value={step.title} onChange={event=>patchStep(index,stepIndex,{title:event.target.value})} placeholder="Museo, plaza, visita..." required/></div>
            <div className="field"><label htmlFor={`${idPrefix}-step-start-${index}-${stepIndex}`}>Desde</label><input id={`${idPrefix}-step-start-${index}-${stepIndex}`} type="time" value={step.startTime || ''} onChange={event=>patchStep(index,stepIndex,{startTime:event.target.value})}/></div>
            <div className="field"><label htmlFor={`${idPrefix}-step-end-${index}-${stepIndex}`}>Hasta</label><input id={`${idPrefix}-step-end-${index}-${stepIndex}`} type="time" value={step.endTime || ''} onChange={event=>patchStep(index,stepIndex,{endTime:event.target.value})}/></div>
            <div className="field step-amount"><label htmlFor={`${idPrefix}-step-amount-${index}-${stepIndex}`}>Importe de esta subactividad</label><input id={`${idPrefix}-step-amount-${index}-${stepIndex}`} type="number" min="0" step="0.01" value={Number.isNaN(step.amount)?'':step.amount} onChange={event=>patchStep(index,stepIndex,{amount:event.target.value===''?Number.NaN:Number(event.target.value)})}/></div>
            <div className="field step-place"><label htmlFor={`${idPrefix}-step-place-${index}-${stepIndex}`}>Lugar de esta subactividad</label><input id={`${idPrefix}-step-place-${index}-${stepIndex}`} value={step.place || ''} onChange={event=>patchStep(index,stepIndex,{place:event.target.value})} placeholder="Dirección o punto de encuentro"/></div>
            <div className="field step-notes"><label htmlFor={`${idPrefix}-step-notes-${index}-${stepIndex}`}>Detalle</label><input id={`${idPrefix}-step-notes-${index}-${stepIndex}`} value={step.notes || ''} onChange={event=>patchStep(index,stepIndex,{notes:event.target.value})} placeholder="Entrada, indicaciones, recordatorio..."/></div>
            <label className="step-optional"><input type="checkbox" checked={Boolean(step.optional)} onChange={event=>patchStep(index,stepIndex,{optional:event.target.checked})}/> Opcional</label>
          </fieldset>)}
          {(occurrence.steps || []).length>0&&<div className="occurrence-steps-total"><span>Subtotal de subactividades</span><strong>{(occurrence.steps || []).reduce((sum,step)=>sum+(Number.isFinite(step.amount)?step.amount:0),0).toLocaleString('es-AR',{maximumFractionDigits:2})}</strong></div>}
        </div>
      </div>)}
    </div>
    <button type="button" className="btn btn-secondary occurrence-add" onClick={()=>onChange([...value,newOccurrence()])}><Plus size={16}/> Agregar bloque a la agenda</button>
    {!value.length&&<small className="field-help">Sin bloques en la agenda</small>}
  </fieldset>
}
