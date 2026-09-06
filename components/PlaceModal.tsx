'use client'

import { FormEvent, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Place } from '@/lib/types'
import { userFacingError } from '@/lib/ui-text'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'

function validExternalUrl(value:string){
  if(!value)return true
  try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}
}

export default function PlaceModal({place,categoryOptions,onClose,onSave,onDelete}:{
  place:Place
  categoryOptions:string[]
  onClose:()=>void
  onSave:(place:Place)=>Promise<void>|void
  onDelete:(place:Place)=>void
}){
  useModalBehavior(onClose)
  const [draft,setDraft]=useState(place)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const patch=<K extends keyof Place>(key:K,value:Place[K])=>setDraft(current=>({...current,[key]:value}))

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    const name=draft.name.trim()
    const category=draft.category.trim()
    const url=draft.url?.trim() || undefined
    if(!name){setMessage('El nombre no puede estar vacío.');return}
    if(!category){setMessage('La categoría no puede estar vacía.');return}
    if(url && !validExternalUrl(url)){setMessage('El enlace debe comenzar con http:// o https://.');return}
    setLoading(true)
    try{await onSave({...draft,name,category,url,address:draft.address?.trim() || undefined,notes:draft.notes?.trim() || undefined})}
    catch(error){setMessage(userFacingError(error,'No pudimos guardar el lugar. Intentá nuevamente.'))}
    finally{setLoading(false)}
  }

  return <div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)onClose()}}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="place-modal-title" onSubmit={submit} noValidate>
      <h2 id="place-modal-title">Editar lugar</h2>
      {message&&<div className="notice error" role="alert">{message}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="place-name">Nombre</label><input id="place-name" value={draft.name} onChange={event=>patch('name',event.target.value)} required autoFocus/></div>
        <CategoryPicker value={draft.category} options={categoryOptions} onChange={value=>patch('category',value)} required/>
        <div className="field"><label htmlFor="place-status">Estado</label><select id="place-status" value={draft.status} onChange={event=>patch('status',event.target.value as Place['status'])}><option value="saved">Guardado</option><option value="candidate">Candidato</option><option value="confirmed">Confirmado</option><option value="visited">Visitado</option><option value="discarded">Descartado</option></select></div>
        <div className="field full"><label htmlFor="place-address">Dirección o zona</label><input id="place-address" value={draft.address || ''} onChange={event=>patch('address',event.target.value)}/></div>
        <div className="field full"><label htmlFor="place-url">Enlace</label><input id="place-url" type="url" value={draft.url || ''} onChange={event=>patch('url',event.target.value)} placeholder="https://..."/></div>
        <div className="field full"><label htmlFor="place-notes">Notas</label><textarea id="place-notes" value={draft.notes || ''} onChange={event=>patch('notes',event.target.value)} placeholder="Horarios, referencias o recomendaciones"/></div>
      </div>
      <div className="modal-actions split">
        <button type="button" className="btn btn-danger" onClick={()=>onDelete(draft)}><Trash2 size={16}/> Eliminar</button>
        <span/>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar cambios'}</button>
      </div>
    </form>
  </div>
}
