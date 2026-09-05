'use client'
import { useEffect, useState } from 'react'
import { Activity } from '@/lib/types'

export default function ActivityModal({activity,onClose,onSave}:{activity:Activity,onClose:()=>void,onSave:(a:Activity)=>void}){
  const [draft,setDraft]=useState(activity)
  useEffect(()=>setDraft(activity),[activity])
  const patch=(key:keyof Activity,value:any)=>setDraft(d=>({...d,[key]:value}))
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <div className="modal">
      <h2>Editar actividad</h2>
      <div className="form-grid">
        <div className="field full"><label>Título</label><input value={draft.title} onChange={e=>patch('title',e.target.value)}/></div>
        <div className="field"><label>Fecha</label><input type="date" value={draft.date} onChange={e=>patch('date',e.target.value)}/></div>
        <div className="field"><label>Estado</label><select value={draft.status} onChange={e=>patch('status',e.target.value)}><option value="idea">Idea</option><option value="planned">Planificado</option><option value="reserved">Reservado</option><option value="paid">Pagado</option><option value="done">Hecho</option></select></div>
        <div className="field"><label>Desde</label><input type="time" value={draft.startTime||''} onChange={e=>patch('startTime',e.target.value)}/></div>
        <div className="field"><label>Hasta</label><input type="time" value={draft.endTime||''} onChange={e=>patch('endTime',e.target.value)}/></div>
        <div className="field full"><label>Lugar</label><input value={draft.place||''} onChange={e=>patch('place',e.target.value)}/></div>
        <div className="field"><label>Costo estimado</label><input type="number" value={draft.estimatedCost} onChange={e=>patch('estimatedCost',Number(e.target.value))}/></div>
        <div className="field"><label>Costo real</label><input type="number" value={draft.actualCost ?? ''} placeholder="Todavía no" onChange={e=>patch('actualCost',e.target.value===''?null:Number(e.target.value))}/></div>
        <div className="field full"><label>Notas</label><textarea value={draft.notes||''} onChange={e=>patch('notes',e.target.value)}/></div>
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>onSave(draft)}>Guardar cambios</button></div>
    </div>
  </div>
}
