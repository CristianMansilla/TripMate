'use client'
import { FormEvent, useState } from 'react'
import { PackingItem } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'

export default function PackingItemModal({
  item,
  categoryOptions,
  onClose,
  onSave,
  onDelete,
}:{
  item:PackingItem
  categoryOptions:string[]
  onClose:()=>void
  onSave:(item:PackingItem)=>Promise<void>|void
  onDelete:(item:PackingItem)=>void
}){
  useModalBehavior(onClose)
  const [label,setLabel]=useState(item.label)
  const [category,setCategory]=useState(item.category)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')

  async function submit(e:FormEvent){
    e.preventDefault()
    setMessage('')
    setLoading(true)
    try{
      await onSave({...item,label:label.trim(),category:category.trim() || 'General'})
    }catch(error){
      setMessage(userFacingError(error,'No pudimos guardar el ítem. Intentá nuevamente.'))
    }finally{
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="packing-modal-title" onSubmit={submit}>
      <h2 id="packing-modal-title">Editar ítem</h2>
      {message&&<div className="notice error">{message}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="packing-label">Ítem</label><input id="packing-label" value={label} onChange={e=>setLabel(e.target.value)} required autoFocus/></div>
        <CategoryPicker className="full" value={category} options={categoryOptions} onChange={setCategory}/>
      </div>
      <div className="modal-actions split">
        <button type="button" className="btn btn-danger" onClick={()=>onDelete(item)}><Trash2 size={16}/> Eliminar</button>
        <span/>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando...':'Guardar cambios'}</button>
      </div>
    </form>
  </div>
}
