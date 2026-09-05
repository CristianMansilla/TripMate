'use client'
import { FormEvent, useState } from 'react'
import { Trip } from '@/lib/types'

export default function NewTripModal({onClose,onCreate}:{onClose:()=>void,onCreate:(input:Omit<Trip,'id'|'status'|'memberNames'>)=>Promise<void>}){
  const [name,setName]=useState('')
  const [destination,setDestination]=useState('')
  const [country,setCountry]=useState('')
  const [startDate,setStartDate]=useState('')
  const [endDate,setEndDate]=useState('')
  const [currency,setCurrency]=useState('ARS')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  async function submit(e:FormEvent){
    e.preventDefault()
    setError('')
    if(endDate<startDate){setError('La fecha de vuelta no puede ser anterior a la de salida.');return}
    setLoading(true)
    try{
      await onCreate({name,destination,country,startDate,endDate,currency})
      onClose()
    }catch(err:any){setError(err?.message || 'No se pudo crear el viaje.')}
    finally{setLoading(false)}
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <form className="modal" onSubmit={submit}>
      <h2>Nuevo viaje</h2>
      <p className="muted" style={{marginTop:-8}}>Podés invitar gente después y editar todo en conjunto.</p>
      {error&&<div className="notice error">{error}</div>}
      <div className="form-grid">
        <div className="field full"><label>Nombre del viaje</label><input placeholder="Brasil 2027" value={name} onChange={e=>setName(e.target.value)} required/></div>
        <div className="field full"><label>Destino</label><input placeholder="Río de Janeiro + Búzios" value={destination} onChange={e=>setDestination(e.target.value)} required/></div>
        <div className="field"><label>País</label><input placeholder="Brasil" value={country} onChange={e=>setCountry(e.target.value)}/></div>
        <div className="field"><label>Moneda base</label><select value={currency} onChange={e=>setCurrency(e.target.value)}><option>ARS</option><option>BRL</option><option>USD</option><option>EUR</option><option>CLP</option><option>UYU</option></select></div>
        <div className="field"><label>Salida</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required/></div>
        <div className="field"><label>Vuelta</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} required/></div>
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Creando…':'Crear viaje'}</button></div>
    </form>
  </div>
}
