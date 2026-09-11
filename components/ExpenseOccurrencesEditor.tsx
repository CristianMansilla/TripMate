'use client'

import { useState } from 'react'
import type { ActivityStatus, ExpenseOccurrence } from '@/lib/types'
import { Plus, Trash2 } from 'lucide-react'
import ActivityStepsEditor from './ActivityStepsEditor'
import ConfirmDialog from './ConfirmDialog'

function newOccurrence():ExpenseOccurrence{
  return {date:'',startTime:'',endTime:'',status:'planned',steps:[]}
}

export default function ExpenseOccurrencesEditor({value,onChange,minDate,maxDate,idPrefix,amountBasis}:{
  value:ExpenseOccurrence[]
  onChange:(value:ExpenseOccurrence[])=>void
  minDate?:string
  maxDate?:string
  idPrefix:string
  amountBasis:'per_person'|'group'
}){
  const [pendingRemoval,setPendingRemoval]=useState<number|null>(null)
  const patch=(index:number,next:Partial<ExpenseOccurrence>)=>onChange(value.map((item,itemIndex)=>itemIndex===index?{...item,...next}:item))

  return <>
    <fieldset className="occurrences-fieldset">
      <legend>Agenda</legend>
      <div className="occurrences-list">
        {value.map((occurrence,index)=><div className="occurrence-card" key={occurrence.id || `new-${index}`}>
          <div className="occurrence-card-head">
            <div><b>Actividad</b><span>{value.length>1?`Aparición ${index+1}`:'Horario'}</span></div>
            <button type="button" className="icon-btn" onClick={()=>setPendingRemoval(index)} title="Quitar de la agenda" aria-label={`Quitar aparición ${index+1}`}><Trash2 size={16}/></button>
          </div>
          <div className="occurrence-row">
            <div className="field occurrence-date"><label htmlFor={`${idPrefix}-date-${index}`}>Día</label><input id={`${idPrefix}-date-${index}`} type="date" min={minDate} max={maxDate} value={occurrence.date} onChange={event=>patch(index,{date:event.target.value})}/></div>
            <div className="field"><label htmlFor={`${idPrefix}-start-${index}`}>Desde</label><input id={`${idPrefix}-start-${index}`} type="time" value={occurrence.startTime || ''} onChange={event=>patch(index,{startTime:event.target.value})}/></div>
            <div className="field"><label htmlFor={`${idPrefix}-end-${index}`}>Hasta</label><input id={`${idPrefix}-end-${index}`} type="time" value={occurrence.endTime || ''} onChange={event=>patch(index,{endTime:event.target.value})}/></div>
            <div className="field"><label htmlFor={`${idPrefix}-status-${index}`}>Estado</label><select id={`${idPrefix}-status-${index}`} value={occurrence.status || 'planned'} onChange={event=>patch(index,{status:event.target.value as ActivityStatus})}><option value="idea">Idea</option><option value="planned">Planificado</option><option value="reserved">Reservado</option><option value="paid">Pagado</option><option value="done">Hecho</option></select></div>
          </div>
          <ActivityStepsEditor value={occurrence.steps || []} onChange={steps=>patch(index,{steps})} idPrefix={`${idPrefix}-step-${index}`} amountBasis={amountBasis}/>
          {(occurrence.steps || []).length>0&&<div className="occurrence-steps-total"><span>Referencia de paradas (no suma al presupuesto)</span><strong>{(occurrence.steps || []).reduce((sum,step)=>sum+(Number.isFinite(step.amount)?step.amount:0),0).toLocaleString('es-AR',{maximumFractionDigits:2})}</strong></div>}
        </div>)}
      </div>
      <button type="button" className="btn btn-secondary occurrence-add" onClick={()=>onChange([...value,newOccurrence()])}><Plus size={15}/> {value.length?'Repetir en otro día':'Agregar al itinerario'}</button>
    </fieldset>
    {pendingRemoval!==null&&<ConfirmDialog title="Quitar de la agenda" confirmLabel="Quitar" confirmIcon={<Trash2 size={16}/>} onClose={()=>setPendingRemoval(null)} onConfirm={()=>{onChange(value.filter((_,index)=>index!==pendingRemoval));setPendingRemoval(null)}}>
      Vas a quitar esta aparición del itinerario y sus paradas. El cambio se aplicará al guardar.
    </ConfirmDialog>}
  </>
}
