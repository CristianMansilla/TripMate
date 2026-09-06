'use client'
import { FormEvent, useState } from 'react'

type Kind='expense'|'reservation'|'packing'|'place'

export default function QuickAddModal({kind,onClose,onSave}:{kind:Kind,onClose:()=>void,onSave:(payload:any)=>Promise<void>|void}){
  const [title,setTitle]=useState('')
  const [amount,setAmount]=useState('')
  const [category,setCategory]=useState(kind==='packing'?'General':kind==='expense'?'Otros':'')
  const [assignedTo,setAssignedTo]=useState('Compartido')
  const [priority,setPriority]=useState('medium')
  const [address,setAddress]=useState('')
  const [url,setUrl]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const labels={expense:'Nuevo gasto',reservation:'Nueva reserva',packing:'Agregar a valija',place:'Nuevo lugar'} as const
  async function submit(e:FormEvent){
    e.preventDefault();setLoading(true)
    try{
      await onSave({title,amount:Number(amount||0),category,assignedTo,priority,address,url,notes})
      onClose()
    }finally{setLoading(false)}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form className="modal" onSubmit={submit}>
      <h2>{labels[kind]}</h2>
      <div className="form-grid">
        <div className="field full"><label>{kind==='packing'?'Ítem':'Nombre'}</label><input value={title} onChange={e=>setTitle(e.target.value)} required autoFocus/></div>
        {kind==='expense'&&<><div className="field"><label>Categoría</label><input value={category} onChange={e=>setCategory(e.target.value)} required/></div><div className="field"><label>Importe</label><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)} required/></div></>}
        {kind==='reservation'&&<><div className="field"><label>Prioridad</label><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></div><div className="field"><label>Importe estimado (opcional)</label><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div></>}
        {kind==='packing'&&<><div className="field"><label>Categoría</label><input value={category} onChange={e=>setCategory(e.target.value)}/></div><div className="field"><label>Asignado a</label><input value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} placeholder="Compartido"/></div></>}
        {kind==='place'&&<>
          <div className="field"><label>Categoría</label><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Alojamiento, comida, paseo..." required/></div>
          <div className="field"><label>Dirección</label><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección o zona"/></div>
          <div className="field full"><label>Link</label><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></div>
          <div className="field full"><label>Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Horarios, referencias, recomendaciones..."/></div>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':'Guardar'}</button></div>
    </form>
  </div>
}
