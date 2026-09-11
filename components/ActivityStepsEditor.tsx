'use client'

import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { ActivityStep } from '@/lib/types'

function newStep():ActivityStep{
  return {title:'',amount:0,startTime:'',endTime:'',place:'',notes:'',optional:false}
}

export default function ActivityStepsEditor({value,onChange,idPrefix,amountBasis='per_person',showAmounts=true}:{
  value:ActivityStep[]
  onChange:(value:ActivityStep[])=>void
  idPrefix:string
  amountBasis?:'per_person'|'group'
  showAmounts?:boolean
}){
  const patch=(index:number,next:Partial<ActivityStep>)=>onChange(value.map((step,stepIndex)=>stepIndex===index?{...step,...next}:step))
  const move=(index:number,direction:-1|1)=>{
    const target=index+direction
    if(target<0 || target>=value.length)return
    const next=[...value]
    ;[next[index],next[target]]=[next[target],next[index]]
    onChange(next)
  }

  return <div className="steps-editor compact-steps-editor">
    <div className="steps-editor-head">
      <div><b>Paradas</b><small>{value.length?`${value.length} cargada${value.length===1?'':'s'}`:'Opcionales'}</small></div>
      <button type="button" className="btn btn-secondary step-add" onClick={()=>onChange([...value,newStep()])}><Plus size={15}/> Agregar parada</button>
    </div>
    {value.map((step,index)=><div className="compact-step" key={step.id || `new-${index}`}>
      <div className="compact-step-main">
        <div className="field step-title"><label htmlFor={`${idPrefix}-title-${index}`}>Parada {index+1}</label><input id={`${idPrefix}-title-${index}`} value={step.title} onChange={event=>patch(index,{title:event.target.value})} placeholder="Museo, plaza, visita..." required/></div>
        <div className="field"><label htmlFor={`${idPrefix}-start-${index}`}>Desde</label><input id={`${idPrefix}-start-${index}`} type="time" value={step.startTime || ''} onChange={event=>patch(index,{startTime:event.target.value})}/></div>
        <div className="field"><label htmlFor={`${idPrefix}-end-${index}`}>Hasta</label><input id={`${idPrefix}-end-${index}`} type="time" value={step.endTime || ''} onChange={event=>patch(index,{endTime:event.target.value})}/></div>
      </div>
      <div className="compact-step-controls">
        <details className="compact-step-details">
          <summary><span className="step-details-more">Más detalles</span><span className="step-details-less">Menos detalles</span><ChevronDown size={15}/></summary>
          <div className="compact-step-extra">
            {showAmounts&&<div className="field"><label htmlFor={`${idPrefix}-amount-${index}`}>{amountBasis==='group'?'Costo grupal informativo':'Costo informativo'}</label><input id={`${idPrefix}-amount-${index}`} type="number" min="0" step="0.01" value={Number.isNaN(step.amount)?'':step.amount} onChange={event=>patch(index,{amount:event.target.value===''?Number.NaN:Number(event.target.value)})}/></div>}
            <div className={`field${showAmounts?'':' full'}`}><label htmlFor={`${idPrefix}-place-${index}`}>Lugar</label><input id={`${idPrefix}-place-${index}`} value={step.place || ''} onChange={event=>patch(index,{place:event.target.value})} placeholder="Dirección o punto de encuentro"/></div>
            <div className="field full"><label htmlFor={`${idPrefix}-notes-${index}`}>Notas</label><input id={`${idPrefix}-notes-${index}`} value={step.notes || ''} onChange={event=>patch(index,{notes:event.target.value})} placeholder="Entrada, indicaciones o recordatorio"/></div>
            <label className="step-optional"><input type="checkbox" checked={Boolean(step.optional)} onChange={event=>patch(index,{optional:event.target.checked})}/> Parada opcional</label>
          </div>
        </details>
        <div className="compact-step-actions">
          <button type="button" className="icon-btn" disabled={index===0} onClick={()=>move(index,-1)} title="Subir parada" aria-label={`Subir parada ${index+1}`}><ArrowUp size={16}/></button>
          <button type="button" className="icon-btn" disabled={index===value.length-1} onClick={()=>move(index,1)} title="Bajar parada" aria-label={`Bajar parada ${index+1}`}><ArrowDown size={16}/></button>
          <button type="button" className="icon-btn" onClick={()=>onChange(value.filter((_,stepIndex)=>stepIndex!==index))} title="Quitar parada" aria-label={`Quitar parada ${index+1}`}><Trash2 size={16}/></button>
        </div>
      </div>
    </div>)}
  </div>
}
