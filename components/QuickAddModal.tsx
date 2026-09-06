'use client'
import { FormEvent, useState } from 'react'
import CategoryPicker from './CategoryPicker'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'

type Kind='expense'|'reservation'|'packing'|'place'

function validExternalUrl(value:string){
  if(!value)return true
  try{return ['http:','https:'].includes(new URL(value).protocol)}catch{return false}
}

export default function QuickAddModal({kind,onClose,onSave,categoryOptions=[]}:{kind:Kind,onClose:()=>void,onSave:(payload:any)=>Promise<void>|void,categoryOptions?:string[]}){
  useModalBehavior(onClose)
  const [title,setTitle]=useState('')
  const [amount,setAmount]=useState('')
  const [amountBasis,setAmountBasis]=useState<'per_person'|'group'>('per_person')
  const [category,setCategory]=useState(categoryOptions[0] || (kind==='packing'?'General':kind==='expense'?'Otros':''))
  const [date,setDate]=useState('')
  const [startTime,setStartTime]=useState('')
  const [endTime,setEndTime]=useState('')
  const [place,setPlace]=useState('')
  const [optional,setOptional]=useState(false)
  const [priority,setPriority]=useState('medium')
  const [dueDate,setDueDate]=useState('')
  const [address,setAddress]=useState('')
  const [url,setUrl]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const labels={expense:'Nuevo gasto',reservation:'Nueva reserva',packing:'Agregar a valija',place:'Nuevo lugar'} as const
  async function submit(e:FormEvent){
    e.preventDefault();setMessage('')
    if(kind==='expense' && (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount)<0)){setMessage('El importe debe ser cero o mayor.');return}
    if(kind==='reservation' && amount.trim() && (!Number.isFinite(Number(amount)) || Number(amount)<0)){setMessage('El importe debe ser cero o mayor.');return}
    if(kind==='place' && !validExternalUrl(url.trim())){setMessage('El enlace debe comenzar con http:// o https://.');return}
    setLoading(true)
    try{
      await onSave({title:title.trim(),amount:amount.trim()===''?undefined:Number(amount),amountBasis,category:category.trim(),priority,dueDate,address,url,notes,date,startTime,endTime,place,optional})
      onClose()
    }catch(error){setMessage(userFacingError(error,'No pudimos guardar. Intentá nuevamente.'))}
    finally{setLoading(false)}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onSubmit={submit}>
      <h2 id="quick-add-title">{labels[kind]}</h2>
      {message&&<div className="notice error">{message}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="quick-title">{kind==='packing'?'Ítem':'Nombre'}</label><input id="quick-title" value={title} onChange={e=>setTitle(e.target.value)} required autoFocus/></div>
        {kind==='expense'&&<>
          <CategoryPicker value={category} options={categoryOptions} onChange={setCategory} required/>
          <div className="field"><label htmlFor="quick-amount">{amountBasis==='group'?'Importe total del servicio':'Importe por persona'}</label><input id="quick-amount" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
          <div className="field"><label htmlFor="quick-basis">El importe corresponde a</label><select id="quick-basis" value={amountBasis} onChange={e=>setAmountBasis(e.target.value as 'per_person'|'group')}><option value="per_person">Cada persona</option><option value="group">Todo el grupo o servicio</option></select></div>
          <div className="field"><label htmlFor="quick-date">Día en itinerario</label><input id="quick-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="field"><label htmlFor="quick-place">Lugar</label><input id="quick-place" value={place} onChange={e=>setPlace(e.target.value)} placeholder="Terminal, hotel, restaurante..."/></div>
          <div className="field"><label htmlFor="quick-start">Desde</label><input id="quick-start" type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></div>
          <div className="field"><label htmlFor="quick-end">Hasta</label><input id="quick-end" type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></div>
          <label className="toggle-field full">
            <input type="checkbox" checked={optional} onChange={e=>setOptional(e.target.checked)}/>
            <span>
              <b>Actividad opcional</b>
              <small>Se muestra como plan tentativo o alternativa para ese horario.</small>
            </span>
          </label>
          <div className="field full"><label htmlFor="quick-notes">Notas</label><textarea id="quick-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalle para el itinerario"/></div>
        </>}
        {kind==='reservation'&&<>
          <div className="field"><label htmlFor="quick-priority">Prioridad</label><select id="quick-priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div>
          <div className="field"><label htmlFor="quick-reservation-due">Fecha límite</label><input id="quick-reservation-due" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
          <div className="field"><label htmlFor="quick-reservation-amount">Importe por persona (opcional)</label><input id="quick-reservation-amount" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <div className="field full"><label htmlFor="quick-reservation-notes">Notas</label><textarea id="quick-reservation-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Condiciones, contacto o recordatorios"/></div>
        </>}
        {kind==='packing'&&<CategoryPicker className="full" value={category} options={categoryOptions} onChange={setCategory}/>}
        {kind==='place'&&<>
          <CategoryPicker value={category} options={categoryOptions} onChange={setCategory} required/>
          <div className="field"><label htmlFor="quick-address">Dirección</label><input id="quick-address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección o zona"/></div>
          <div className="field full"><label htmlFor="quick-url">Link</label><input id="quick-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></div>
          <div className="field full"><label htmlFor="quick-place-notes">Notas</label><textarea id="quick-place-notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Horarios, referencias, recomendaciones..."/></div>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar'}</button></div>
    </form>
  </div>
}
