'use client'
import { useEffect, useState } from 'react'
import { Activity, Expense } from '@/lib/types'
import { Trash2 } from 'lucide-react'

type ExpenseDraft = Expense & {
  date?: string
  startTime?: string
  endTime?: string
  place?: string
  notes?: string
  optional?: boolean
}

export default function ExpenseModal({expense,activities,onClose,onSave,onDelete,categoryOptions=[]}:{expense:Expense,activities:Activity[],onClose:()=>void,onSave:(expense:ExpenseDraft)=>Promise<void>|void,onDelete?:(expense:Expense)=>void,categoryOptions?:string[]}){
  const linkedActivity=activities.find(activity=>activity.id===expense.activityId)
  const [draft,setDraft]=useState<ExpenseDraft>({...expense,date:linkedActivity?.date || '',startTime:linkedActivity?.startTime || '',endTime:linkedActivity?.endTime || '',place:linkedActivity?.place || '',notes:linkedActivity?.notes || '',optional:Boolean(linkedActivity?.optional)})
  useEffect(()=>setDraft({...expense,date:linkedActivity?.date || '',startTime:linkedActivity?.startTime || '',endTime:linkedActivity?.endTime || '',place:linkedActivity?.place || '',notes:linkedActivity?.notes || '',optional:Boolean(linkedActivity?.optional)}),[expense,linkedActivity])
  const patch=(key:keyof ExpenseDraft,value:any)=>setDraft(current=>({...current,[key]:value}))

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <div className="modal">
      <h2>Editar gasto</h2>
      <div className="form-grid">
        {categoryOptions.length>0&&<datalist id="expense-edit-category-options">{categoryOptions.map(option=><option key={option} value={option}/>)}</datalist>}
        <div className="field full"><label>Nombre</label><input value={draft.title} onChange={e=>patch('title',e.target.value)} required/></div>
        <div className="field"><label>Categoría</label><input list="expense-edit-category-options" value={draft.category} onChange={e=>patch('category',e.target.value)} required/></div>
        <div className="field"><label>Importe por persona</label><input type="number" min="0" value={draft.amount} onChange={e=>patch('amount',Number(e.target.value))} required/></div>
        <div className="field"><label>Día en itinerario</label><input type="date" value={draft.date || ''} onChange={e=>patch('date',e.target.value)}/></div>
        <div className="field"><label>Lugar</label><input value={draft.place || ''} onChange={e=>patch('place',e.target.value)} placeholder="Terminal, hotel, restaurante..."/></div>
        <div className="field"><label>Desde</label><input type="time" value={draft.startTime || ''} onChange={e=>patch('startTime',e.target.value)}/></div>
        <div className="field"><label>Hasta</label><input type="time" value={draft.endTime || ''} onChange={e=>patch('endTime',e.target.value)}/></div>
        <div className="field"><label>Estado</label><select value={draft.status} onChange={e=>patch('status',e.target.value)}>
          <option value="estimated">Estimado</option>
          <option value="confirmed">Confirmado</option>
          <option value="paid">Pagado</option>
        </select></div>
        <label className="toggle-field">
          <input type="checkbox" checked={draft.included!==false} disabled={!draft.activityId && !draft.date} onChange={e=>patch('included',e.target.checked)}/>
          <span>
            <b>Incluir en el total</b>
            <small>{draft.activityId || draft.date?'Desmarcalo si querés guardarlo como referencia sin sumarlo al presupuesto.':'Cargá un día de itinerario para poder incluirlo en el presupuesto.'}</small>
          </span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={Boolean(draft.optional)} onChange={e=>patch('optional',e.target.checked)}/>
          <span>
            <b>Actividad opcional</b>
            <small>Se muestra en el itinerario como plan tentativo o alternativa para ese horario.</small>
          </span>
        </label>
        <div className="field full"><label>Notas</label><textarea value={draft.notes || ''} onChange={e=>patch('notes',e.target.value)} placeholder="Detalle para el itinerario"/></div>
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
