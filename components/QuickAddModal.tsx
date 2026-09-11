'use client'

import { FormEvent, useState } from 'react'
import CategoryPicker from './CategoryPicker'
import DiscardChangesDialog from './DiscardChangesDialog'
import Snackbar from './Snackbar'
import { useDiscardConfirmation } from './useDiscardConfirmation'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'
import { userFacingError } from '@/lib/ui-text'
import PlaceAutocomplete, { PlaceAutocompleteOption } from './PlaceAutocomplete'

type Kind='packing'|'place'

function validExternalUrl(value:string){
  if(!value)return true
  try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}
}

export default function QuickAddModal({kind,tripId,placeSuggestions=[],onClose,onSave,categoryOptions=[]}:{
  kind:Kind
  tripId:string
  placeSuggestions?:PlaceAutocompleteOption[]
  onClose:()=>void
  onSave:(payload:{title:string;category:string;address?:string;latitude?:number;longitude?:number;url?:string;notes?:string})=>Promise<void>|void
  categoryOptions?:string[]
}){
  const initialCategory=categoryOptions[0] || 'General'
  const [title,setTitle]=useState('')
  const [category,setCategory]=useState(initialCategory)
  const [address,setAddress]=useState('')
  const [latitude,setLatitude]=useState<number|undefined>()
  const [longitude,setLongitude]=useState<number|undefined>()
  const [url,setUrl]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const runOnce=useSubmissionGuard()
  const discard=useDiscardConfirmation(Boolean(title || category!==initialCategory || address || url || notes),onClose,loading)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    if(!title.trim()){setMessage(kind==='packing'?'El ítem no puede estar vacío.':'El nombre no puede estar vacío.');return}
    if(kind==='place' && !validExternalUrl(url.trim())){setMessage('El enlace debe comenzar con http:// o https://.');return}
    await runOnce(async()=>{
      setLoading(true)
      try{
        await onSave({title:title.trim(),category:category.trim(),address:address.trim() || undefined,latitude,longitude,url:url.trim() || undefined,notes:notes.trim() || undefined})
        onClose()
      }catch(error){setMessage(userFacingError(error,'No pudimos guardar. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  return <><div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)discard.requestClose()}}>
    <form ref={dialogRef} className="modal sticky-actions-modal" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" tabIndex={-1} onSubmit={submit} noValidate>
      <h2 id="quick-add-title">{kind==='packing'?'Agregar a valija':'Nuevo lugar'}</h2>
      <Snackbar message={message} tone="error" onClose={()=>setMessage('')}/>
      <div className="form-grid">
        <div className="field full"><label htmlFor="quick-title">{kind==='packing'?'Ítem':'Nombre'}</label><input id="quick-title" value={title} onChange={event=>setTitle(event.target.value)} autoFocus required/></div>
        <CategoryPicker className={kind==='packing'?'full':''} value={category} options={categoryOptions} onChange={setCategory} required/>
        {kind==='place'&&<>
          <PlaceAutocomplete id="quick-address" label="Dirección" tripId={tripId} value={address} onChange={value=>{setAddress(value);setLatitude(undefined);setLongitude(undefined)}} localSuggestions={placeSuggestions} placeholder="Dirección o zona" onSelect={selection=>{setAddress(selection.address || selection.value);setTitle(current=>current.trim()?current:selection.name);setLatitude(selection.latitude);setLongitude(selection.longitude)}}/>
          <div className="field full"><label htmlFor="quick-url">Link</label><input id="quick-url" type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://..."/></div>
          <div className="field full"><label htmlFor="quick-place-notes">Notas</label><textarea id="quick-place-notes" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Horarios, referencias o recomendaciones"/></div>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar'}</button></div>
    </form>
  </div>{discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
