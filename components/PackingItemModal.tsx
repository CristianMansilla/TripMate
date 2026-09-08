'use client'
import { FormEvent, useState } from 'react'
import { PackingItem } from '@/lib/types'
import { Trash2 } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'
import Snackbar from './Snackbar'
import { useSubmissionGuard } from './useSubmissionGuard'
import DiscardChangesDialog from './DiscardChangesDialog'
import { useDiscardConfirmation } from './useDiscardConfirmation'

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
  const [message,setMessage]=useState('')
  const runOnce=useSubmissionGuard()
  const discard=useDiscardConfirmation(label!==item.label || category!==item.category,onClose)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)

  async function submit(e:FormEvent){
    e.preventDefault()
    setMessage('')
    await runOnce(async()=>{
      setLoading(true)
      try{await onSave({...item,label:label.trim(),category:category.trim() || 'General'})}
      catch(error){setMessage(userFacingError(error,'No pudimos guardar el ítem. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  return <><div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)discard.requestClose()}}>
    <form ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="packing-modal-title" tabIndex={-1} onSubmit={submit}>
      <h2 id="packing-modal-title">Editar ítem</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="form-grid">
        <div className="field full"><label htmlFor="packing-label">Ítem</label><input id="packing-label" value={label} onChange={e=>setLabel(e.target.value)} required/></div>
        <CategoryPicker className="full" value={category} options={categoryOptions} onChange={setCategory}/>
      </div>
      <div className="modal-actions split">
        <button type="button" className="btn btn-danger" onClick={()=>onDelete(item)}><Trash2 size={16}/> Eliminar</button>
        <span/>
        <button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando...':'Guardar cambios'}</button>
      </div>
    </form>
  </div>{discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
