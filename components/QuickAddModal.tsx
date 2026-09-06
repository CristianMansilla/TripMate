'use client'
import { FormEvent, useState } from 'react'
import CategoryPicker from './CategoryPicker'

type Kind='expense'|'reservation'|'packing'|'place'

export default function QuickAddModal({kind,onClose,onSave,categoryOptions=[]}:{kind:Kind,onClose:()=>void,onSave:(payload:any)=>Promise<void>|void,categoryOptions?:string[]}){
  const [title,setTitle]=useState('')
  const [amount,setAmount]=useState('')
  const [category,setCategory]=useState(categoryOptions[0] || (kind==='packing'?'General':kind==='expense'?'Otros':''))
  const [date,setDate]=useState('')
  const [startTime,setStartTime]=useState('')
  const [endTime,setEndTime]=useState('')
  const [place,setPlace]=useState('')
  const [optional,setOptional]=useState(false)
  const [priority,setPriority]=useState('medium')
  const [address,setAddress]=useState('')
  const [url,setUrl]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const labels={expense:'Nuevo gasto',reservation:'Nueva reserva',packing:'Agregar a valija',place:'Nuevo lugar'} as const
  async function submit(e:FormEvent){
    e.preventDefault();setLoading(true)
    try{
      await onSave({title,amount:Number(amount||0),category,priority,address,url,notes,date,startTime,endTime,place,optional})
      onClose()
    }finally{setLoading(false)}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form className="modal" onSubmit={submit}>
      <h2>{labels[kind]}</h2>
      <div className="form-grid">
        <div className="field full"><label>{kind==='packing'?'Ítem':'Nombre'}</label><input value={title} onChange={e=>setTitle(e.target.value)} required autoFocus/></div>
        {kind==='expense'&&<>
          <CategoryPicker value={category} options={categoryOptions} onChange={setCategory} required/>
          <div className="field"><label>Importe por persona</label><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} required/></div>
          <div className="field"><label>Día en itinerario</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="field"><label>Lugar</label><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Terminal, hotel, restaurante..."/></div>
          <div className="field"><label>Desde</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></div>
          <div className="field"><label>Hasta</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></div>
          <label className="toggle-field full">
            <input type="checkbox" checked={optional} onChange={e=>setOptional(e.target.checked)}/>
            <span>
              <b>Actividad opcional</b>
              <small>Se muestra como plan tentativo o alternativa para ese horario.</small>
            </span>
          </label>
          <div className="field full"><label>Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalle para el itinerario"/></div>
        </>}
        {kind==='reservation'&&<><div className="field"><label>Prioridad</label><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div><div className="field"><label>Importe por persona (opcional)</label><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div></>}
        {kind==='packing'&&<CategoryPicker className="full" value={category} options={categoryOptions} onChange={setCategory}/>}
        {kind==='place'&&<>
          <CategoryPicker value={category} options={categoryOptions} onChange={setCategory} required/>
          <div className="field"><label>Dirección</label><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección o zona"/></div>
          <div className="field full"><label>Link</label><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></div>
          <div className="field full"><label>Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Horarios, referencias, recomendaciones..."/></div>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar'}</button></div>
    </form>
  </div>
}
