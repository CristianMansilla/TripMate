'use client'
import { FormEvent, useState } from 'react'
import { Trip } from '@/lib/types'
import { useModalBehavior } from './useModalBehavior'
import { userFacingError } from '@/lib/ui-text'
import { useSubmissionGuard } from './useSubmissionGuard'

export default function NewTripModal({onClose,onCreate}:{onClose:()=>void,onCreate:(input:Omit<Trip,'id'|'status'|'memberNames'>)=>Promise<void>}){
  const dialogRef=useModalBehavior<HTMLFormElement>(onClose)
  const [name,setName]=useState('')
  const [destination,setDestination]=useState('')
  const [country,setCountry]=useState('')
  const [startDate,setStartDate]=useState('')
  const [endDate,setEndDate]=useState('')
  const [currency,setCurrency]=useState('ARS')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const runOnce=useSubmissionGuard()

  async function submit(e:FormEvent){
    e.preventDefault()
    setError('')
    if(!name.trim() || !destination.trim()){setError('Completá el nombre y el destino del viaje.');return}
    if(!startDate || !endDate){setError('Completá las fechas de salida y vuelta.');return}
    if(endDate<startDate){setError('La fecha de vuelta no puede ser anterior a la de salida.');return}
    await runOnce(async()=>{
      setLoading(true)
      try{await onCreate({name:name.trim(),destination:destination.trim(),country:country.trim(),startDate,endDate,currency});onClose()}
      catch(error){setError(userFacingError(error,'No se pudo crear el viaje.'))}
      finally{setLoading(false)}
    })
  }

  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <form ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="new-trip-title" tabIndex={-1} onSubmit={submit}>
      <h2 id="new-trip-title">Nuevo viaje</h2>
      <p className="muted" style={{marginTop:-8}}>Podés invitar gente después y editar todo en conjunto.</p>
      {error&&<div className="notice error">{error}</div>}
      <div className="form-grid">
        <div className="field full"><label htmlFor="trip-name">Nombre del viaje</label><input id="trip-name" placeholder="Brasil 2027" value={name} onChange={e=>setName(e.target.value)} required/></div>
        <div className="field full"><label htmlFor="trip-destination">Destino</label><input id="trip-destination" placeholder="Río de Janeiro + Búzios" value={destination} onChange={e=>setDestination(e.target.value)} required/></div>
        <div className="field"><label htmlFor="trip-country">País</label><input id="trip-country" placeholder="Brasil" value={country} onChange={e=>setCountry(e.target.value)}/></div>
        <div className="field"><label htmlFor="trip-currency">Moneda base</label><select id="trip-currency" value={currency} onChange={e=>setCurrency(e.target.value)}><option>ARS</option><option>BRL</option><option>USD</option><option>EUR</option><option>CLP</option><option>UYU</option></select></div>
        <div className="field"><label htmlFor="trip-start">Salida</label><input id="trip-start" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required/></div>
        <div className="field"><label htmlFor="trip-end">Vuelta</label><input id="trip-end" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} required/></div>
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={loading}>{loading?'Creando…':'Crear viaje'}</button></div>
    </form>
  </div>
}
