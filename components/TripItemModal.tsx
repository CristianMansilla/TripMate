'use client'

import { FormEvent, useMemo, useState } from 'react'
import { CalendarDays, ClipboardCheck, FilePenLine, Trash2, WalletCards } from 'lucide-react'
import type { Activity, Expense, ExpenseOccurrence, Reservation, TripItem, TripItemSaveInput } from '@/lib/types'
import CategoryPicker from './CategoryPicker'
import ConfirmDialog from './ConfirmDialog'
import DiscardChangesDialog from './DiscardChangesDialog'
import ExpenseOccurrencesEditor from './ExpenseOccurrencesEditor'
import PlaceAutocomplete, { PlaceAutocompleteOption } from './PlaceAutocomplete'
import Snackbar from './Snackbar'
import { useDiscardConfirmation } from './useDiscardConfirmation'
import { useModalBehavior } from './useModalBehavior'
import { useSubmissionGuard } from './useSubmissionGuard'
import { userFacingError } from '@/lib/ui-text'

export type TripItemTab='general'|'itinerary'|'cost'|'reservation'
type ItemFacet=Exclude<TripItemTab,'general'>

export default function TripItemModal({
  item,activities,expense,reservation,currency,minDate,maxDate,categoryOptions,placeSuggestions,
  initialTab='general',initialFacet,isNew=false,
  onClose,onSave,onDelete,
}:{
  item:TripItem
  activities:Activity[]
  expense?:Expense
  reservation?:Reservation
  currency:string
  minDate:string
  maxDate:string
  categoryOptions:string[]
  placeSuggestions:PlaceAutocompleteOption[]
  initialTab?:TripItemTab
  initialFacet?:Exclude<TripItemTab,'general'>
  isNew?:boolean
  onClose:()=>void
  onSave:(input:TripItemSaveInput)=>Promise<void>|void
  onDelete?:(item:TripItem)=>void
}){
  const initialOccurrences=useMemo<ExpenseOccurrence[]>(()=>{
    if(activities.length)return activities.map(activity=>({
      id:activity.id,date:activity.date,startTime:activity.startTime,endTime:activity.endTime,
      status:activity.status,steps:activity.steps || [],
    }))
    return initialFacet==='itinerary'?[{date:minDate,status:'planned',steps:[]}]:[]
  },[activities,initialFacet,minDate])
  const [draftItem,setDraftItem]=useState(item)
  const [occurrences,setOccurrences]=useState(initialOccurrences)
  const [hasItinerary,setHasItinerary]=useState(activities.length>0 || initialFacet==='itinerary')
  const [hasCost,setHasCost]=useState(Boolean(expense) || initialFacet==='cost')
  const [hasReservation,setHasReservation]=useState(Boolean(reservation) || initialFacet==='reservation')
  const [draftExpense,setDraftExpense]=useState<Expense>(expense || {
    id:'',tripId:item.tripId,itemId:item.id,title:item.title,category:item.category,amount:0,
    amountBasis:'per_person',occurrencePricing:'total',status:'estimated',scope:'per_person',
    included:true,currency,
  })
  const [draftReservation,setDraftReservation]=useState<Reservation>(reservation || {
    id:'',tripId:item.tripId,itemId:item.id,title:item.title,status:'pending',priority:'medium',
  })
  const [activeTab,setActiveTab]=useState<TripItemTab>(initialTab)
  const [reviewedTabs,setReviewedTabs]=useState<TripItemTab[]>(initialTab==='general'?['general']:['general',initialTab])
  const [facetToRemove,setFacetToRemove]=useState<ItemFacet|null>(null)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const [messageTone,setMessageTone]=useState<'error'|'info'>('error')
  const firstScheduledDate=occurrences.map(occurrence=>occurrence.date).filter(Boolean).sort()[0]
  const reservationMaxDate=firstScheduledDate || maxDate
  const runOnce=useSubmissionGuard()
  const [initial]=useState(()=>JSON.stringify({item,initialOccurrences,hasItinerary:activities.length>0 || initialFacet==='itinerary',hasCost:Boolean(expense) || initialFacet==='cost',hasReservation:Boolean(reservation) || initialFacet==='reservation',expense:draftExpense,reservation:draftReservation}))
  const current=JSON.stringify({item:draftItem,initialOccurrences:occurrences,hasItinerary,hasCost,hasReservation,expense:draftExpense,reservation:draftReservation})
  const discard=useDiscardConfirmation(current!==initial,onClose,loading)
  const dialogRef=useModalBehavior<HTMLFormElement>(discard.requestClose)
  const patchItem=<K extends keyof TripItem>(key:K,value:TripItem[K])=>setDraftItem(current=>({...current,[key]:value}))
  const patchExpense=<K extends keyof Expense>(key:K,value:Expense[K])=>setDraftExpense(current=>({...current,[key]:value}))
  const patchReservation=<K extends keyof Reservation>(key:K,value:Reservation[K])=>setDraftReservation(current=>({...current,[key]:value}))

  function toggleItinerary(enabled:boolean){
    if(!enabled && activities.length){setFacetToRemove('itinerary');return}
    setHasItinerary(enabled)
    if(enabled && !occurrences.length)setOccurrences([{date:minDate,status:'planned',steps:[]}])
  }

  function toggleFacet(facet:ItemFacet,enabled:boolean){
    if(facet==='itinerary'){toggleItinerary(enabled);return}
    const persisted=facet==='cost'?Boolean(expense):Boolean(reservation)
    if(!enabled && persisted){setFacetToRemove(facet);return}
    if(facet==='cost')setHasCost(enabled)
    else setHasReservation(enabled)
  }

  function selectTab(tab:TripItemTab){
    setActiveTab(tab)
    setReviewedTabs(current=>current.includes(tab)?current:[...current,tab])
  }

  function confirmFacetRemoval(){
    if(facetToRemove==='itinerary')setHasItinerary(false)
    if(facetToRemove==='cost')setHasCost(false)
    if(facetToRemove==='reservation')setHasReservation(false)
    setFacetToRemove(null)
  }

  async function submit(event:FormEvent){
    event.preventDefault()
    setMessage('')
    setMessageTone('error')
    const title=draftItem.title.trim()
    const category=draftItem.category.trim()
    if(!title){setActiveTab('general');setMessage('El nombre no puede estar vacío.');return}
    if(!category){setActiveTab('general');setMessage('El tipo no puede estar vacío.');return}
    if(category.length>60){setActiveTab('general');setMessage('El tipo no puede superar los 60 caracteres.');return}
    if(isNew && initialFacet && !reviewedTabs.includes(initialFacet)){
      selectTab(initialFacet)
      setMessageTone('info')
      setMessage(`Revisá los datos de ${initialFacet==='itinerary'?'Itinerario':initialFacet==='cost'?'Costo':'Reserva'} antes de crear.`)
      return
    }
    if(!hasItinerary && !hasCost && !hasReservation){setMessage('Activá Itinerario, Costo o Reserva para guardar el elemento.');return}
    if(hasItinerary && !occurrences.length){setActiveTab('itinerary');setMessage('Agregá al menos un día o desactivá Itinerario.');return}
    if(hasItinerary && occurrences.some(occurrence=>!occurrence.date || occurrence.date<minDate || occurrence.date>maxDate)){
      setActiveTab('itinerary');setMessage('Los días deben estar dentro de las fechas del viaje.');return
    }
    if(hasItinerary && occurrences.some(occurrence=>occurrence.startTime && occurrence.endTime && occurrence.endTime<=occurrence.startTime)){
      setActiveTab('itinerary');setMessage('La hora de fin debe ser posterior a la hora de inicio.');return
    }
    if(hasItinerary && occurrences.some(occurrence=>(occurrence.steps || []).some(step=>!step.title.trim()))){
      setActiveTab('itinerary');setMessage('Completá o quitá las paradas sin nombre.');return
    }
    if(hasCost && (!Number.isFinite(draftExpense.amount) || draftExpense.amount<0)){
      setActiveTab('cost');setMessage('El costo debe ser cero o mayor.');return
    }
    if(hasReservation && draftReservation.dueDate && draftReservation.dueDate>reservationMaxDate){
      setActiveTab('reservation');setMessage(firstScheduledDate?'La fecha para reservar no puede ser posterior al primer día programado.':'La fecha para reservar no puede ser posterior al final del viaje.');return
    }
    await runOnce(async()=>{
      setLoading(true)
      try{
        const common={...draftItem,title,category,place:draftItem.place?.trim() || undefined,notes:draftItem.notes?.trim() || undefined}
        await onSave({
          item:common,
          activities:hasItinerary?occurrences:[],
          expense:hasCost?{...draftExpense,title,category,place:common.place,notes:common.notes,optional:common.optional}:null,
          reservation:hasReservation?{...draftReservation,title,notes:common.notes}:null,
        })
      }catch(error){setMessage(userFacingError(error,'No pudimos guardar el elemento. Intentá nuevamente.'))}
      finally{setLoading(false)}
    })
  }

  const tabs:[TripItemTab,string,typeof FilePenLine][]=[
    ['general','Datos',FilePenLine],['itinerary','Itinerario',CalendarDays],['cost','Costo',WalletCards],['reservation','Reserva',ClipboardCheck],
  ]
  return <><div className="modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)discard.requestClose()}}>
    <form ref={dialogRef} className="modal expense-modal trip-item-modal sticky-actions-modal" role="dialog" aria-modal="true" aria-labelledby="trip-item-modal-title" tabIndex={-1} onSubmit={submit} noValidate>
      <h2 id="trip-item-modal-title">{isNew?initialFacet==='itinerary'?'Nueva actividad':initialFacet==='cost'?'Nuevo gasto':'Nueva reserva':'Editar detalle del viaje'}</h2>
      <Snackbar message={message} tone={messageTone} onClose={()=>setMessage('')}/>
      <div className="expense-form-tabs trip-item-tabs" role="tablist" aria-label="Secciones del elemento">
        {tabs.map(([value,label,Icon])=><button key={value} type="button" role="tab" aria-selected={activeTab===value} className={activeTab===value?'active':''} onClick={()=>selectTab(value)}><Icon size={17}/>{label}{value==='itinerary'&&hasItinerary?` (${occurrences.length})`:''}</button>)}
      </div>

      <section className="expense-form-section" role="tabpanel" hidden={activeTab!=='general'}>
        <div className="expense-section-grid">
          <div className="field full"><label htmlFor="trip-item-title">Nombre</label><input id="trip-item-title" value={draftItem.title} onChange={event=>patchItem('title',event.target.value)} autoFocus required/></div>
          <CategoryPicker label="Tipo" value={draftItem.category} options={categoryOptions} onChange={value=>patchItem('category',value)} required/>
          <PlaceAutocomplete id="trip-item-place" label="Lugar" tripId={item.tripId} value={draftItem.place || ''} onChange={value=>setDraftItem(current=>({...current,place:value,placeId:undefined}))} onSelect={selection=>patchItem('placeId',selection.source==='saved'?selection.id:undefined)} localSuggestions={placeSuggestions} placeholder="Dirección, zona o punto de encuentro"/>
          <label className="toggle-field full"><input type="checkbox" checked={draftItem.optional} onChange={event=>patchItem('optional',event.target.checked)}/><span><b>Opcional</b><small>Se identifica como alternativa dentro del plan.</small></span></label>
          <div className="field full"><label htmlFor="trip-item-notes">Notas</label><textarea id="trip-item-notes" value={draftItem.notes || ''} onChange={event=>patchItem('notes',event.target.value)} placeholder="Información, condiciones o recordatorios"/></div>
        </div>
      </section>

      <section className="expense-form-section" role="tabpanel" hidden={activeTab!=='itinerary'}>
        <label className="toggle-field facet-toggle"><input type="checkbox" checked={hasItinerary} onChange={event=>toggleItinerary(event.target.checked)}/><span><b>Mostrar en Itinerario</b></span></label>
        {hasItinerary&&<ExpenseOccurrencesEditor idPrefix="trip-item" value={occurrences} onChange={setOccurrences} minDate={minDate} maxDate={maxDate} amountBasis={draftExpense.amountBasis || 'per_person'}/>}
      </section>

      <section className="expense-form-section" role="tabpanel" hidden={activeTab!=='cost'}>
        <label className="toggle-field facet-toggle"><input type="checkbox" checked={hasCost} onChange={event=>toggleFacet('cost',event.target.checked)}/><span><b>Incluir costo</b></span></label>
        {hasCost&&<div className="expense-section-grid">
          <div className="field"><label htmlFor="trip-item-amount">{draftExpense.amountBasis==='group'?'Costo del grupo':'Costo'}</label><input id="trip-item-amount" type="number" min="0" step="0.01" value={Number.isNaN(draftExpense.amount)?'':draftExpense.amount} onChange={event=>patchExpense('amount',event.target.value===''?Number.NaN:Number(event.target.value))}/></div>
          <div className="field"><label htmlFor="trip-item-cost-status">Estado del costo</label><select id="trip-item-cost-status" value={draftExpense.status} onChange={event=>patchExpense('status',event.target.value as Expense['status'])}><option value="estimated">Estimado</option><option value="confirmed">Confirmado</option><option value="paid">Pagado</option></select></div>
          <label className="toggle-field"><input type="checkbox" checked={draftExpense.amountBasis==='group'} onChange={event=>patchExpense('amountBasis',event.target.checked?'group':'per_person')}/><span><b>Precio para todo el grupo</b></span></label>
          <label className="toggle-field"><input type="checkbox" checked={draftExpense.included!==false} onChange={event=>patchExpense('included',event.target.checked)}/><span><b>Incluir en el total</b></span></label>
          {occurrences.length>1&&<div className="field full"><label htmlFor="trip-item-pricing">Apariciones repetidas</label><select id="trip-item-pricing" value={draftExpense.occurrencePricing || 'total'} onChange={event=>patchExpense('occurrencePricing',event.target.value as Expense['occurrencePricing'])}><option value="total">El importe es el total</option><option value="per_occurrence">El importe se cobra en cada aparición</option></select></div>}
        </div>}
      </section>

      <section className="expense-form-section" role="tabpanel" hidden={activeTab!=='reservation'}>
        <label className="toggle-field facet-toggle"><input type="checkbox" checked={hasReservation} onChange={event=>toggleFacet('reservation',event.target.checked)}/><span><b>Requiere reserva</b></span></label>
        {hasReservation&&<div className="expense-section-grid">
          <div className="field"><label htmlFor="trip-item-reservation-status">Estado de la reserva</label><select id="trip-item-reservation-status" value={draftReservation.status} onChange={event=>patchReservation('status',event.target.value as Reservation['status'])}><option value="watching">Esperando</option><option value="pending">Pendiente</option><option value="reserved">Reservado</option>{draftReservation.status==='paid'&&<option value="paid">Pagado (estado anterior)</option>}</select></div>
          <div className="field"><label htmlFor="trip-item-due-date">Reservar antes del</label><input id="trip-item-due-date" type="date" max={reservationMaxDate} value={draftReservation.dueDate || ''} onChange={event=>patchReservation('dueDate',event.target.value || undefined)}/></div>
          {draftReservation.amount!==undefined&&!hasCost&&<div className="reservation-cost-note">Importe anterior conservado: <b>{currency} {draftReservation.amount.toLocaleString('es-AR')}</b></div>}
        </div>}
      </section>

      <div className="modal-actions split">
        {!isNew&&onDelete?<button type="button" className="btn btn-danger trip-item-delete" disabled={loading} onClick={()=>onDelete(draftItem)}><Trash2 size={16}/> Eliminar del viaje</button>:<span/>}
        <span/>
        <button type="button" className="btn btn-secondary" onClick={discard.requestClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={loading}>{loading?'Guardando…':isNew&&initialFacet&&!reviewedTabs.includes(initialFacet)?'Continuar':isNew?'Crear':'Guardar cambios'}</button>
      </div>
    </form>
  </div>
  {facetToRemove&&<ConfirmDialog title={facetToRemove==='itinerary'?'Quitar del itinerario':facetToRemove==='cost'?'Quitar costo':'Quitar reserva'} confirmLabel="Quitar" confirmIcon={<Trash2 size={16}/>} onClose={()=>setFacetToRemove(null)} onConfirm={confirmFacetRemoval}>
    {facetToRemove==='itinerary'?'Se eliminarán todas las apariciones y sus paradas al guardar. El costo y la reserva se conservarán.':facetToRemove==='cost'?'El elemento dejará de aparecer en Presupuesto al guardar. Su itinerario y reserva se conservarán.':'El seguimiento de la reserva se eliminará al guardar. Su itinerario y costo se conservarán.'}
  </ConfirmDialog>}
  {discard.discardOpen&&<DiscardChangesDialog onClose={discard.cancelDiscard} onConfirm={discard.confirmDiscard}/>}</>
}
