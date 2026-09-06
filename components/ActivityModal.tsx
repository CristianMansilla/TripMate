'use client'
import { useEffect, useState } from 'react'
import { Activity } from '@/lib/types'
import { Trash2 } from 'lucide-react'

const activityCategories:{value:Activity['category'];label:string}[]=[
  {value:'transport',label:'Transporte'},
  {value:'lodging',label:'Alojamiento'},
  {value:'food',label:'Comida'},
  {value:'activity',label:'Actividad'},
  {value:'museum',label:'Museo'},
  {value:'nightlife',label:'Noche'},
  {value:'event',label:'Evento'},
  {value:'other',label:'Otro'},
]

export default function ActivityModal({activity,onClose,onSave,onDelete}:{activity:Activity,onClose:()=>void,onSave:(a:Activity)=>Promise<void>|void,onDelete?:(a:Activity)=>void}){
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
        <div className="field"><label>Categoría</label><select value={draft.category} onChange={e=>patch('category',e.target.value)}>{activityCategories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
        <div className="field"><label>Desde</label><input type="time" value={draft.startTime||''} onChange={e=>patch('startTime',e.target.value)}/></div>
        <div className="field"><label>Hasta</label><input type="time" value={draft.endTime||''} onChange={e=>patch('endTime',e.target.value)}/></div>
        <label className="toggle-field full">
          <input type="checkbox" checked={Boolean(draft.optional)} onChange={e=>patch('optional',e.target.checked)}/>
          <span>
            <b>Actividad opcional</b>
            <small>Usala para planes tentativos o alternativas para cubrir ese horario.</small>
          </span>
        </label>
        <div className="field full"><label>Lugar</label><input value={draft.place||''} onChange={e=>patch('place',e.target.value)}/></div>
        <div className="field full"><label>Notas</label><textarea value={draft.notes||''} onChange={e=>patch('notes',e.target.value)}/></div>
      </div>
      <div className="modal-actions split">
        {onDelete&&<button className="btn btn-danger" onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>}
        <span/>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={()=>onSave(draft)}>Guardar cambios</button>
      </div>
    </div>
  </div>
}
