'use client'
import { FormEvent, useState } from 'react'
import { PackingItem } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import CategoryPicker from './CategoryPicker'

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
  const [label,setLabel]=useState(item.label)
  const [category,setCategory]=useState(item.category)
  const [loading,setLoading]=useState(false)

  async function submit(e:FormEvent){
    e.preventDefault()
    setLoading(true)
    try{
      await onSave({...item,label:label.trim(),category:category.trim() || 'General'})
    }finally{
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form className="modal" onSubmit={submit}>
      <h2>Editar ítem</h2>
      <div className="form-grid">
        <div className="field full"><label>Ítem</label><input value={label} onChange={e=>setLabel(e.target.value)} required autoFocus/></div>
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
