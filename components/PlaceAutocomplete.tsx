'use client'

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LoaderCircle, MapPin } from 'lucide-react'

export type PlaceAutocompleteOption={
  id:string
  name:string
  address?:string
  latitude?:number|null
  longitude?:number|null
}

export type PlaceAutocompleteSelection={
  id:string
  name:string
  address:string
  value:string
  latitude?:number
  longitude?:number
  approximate?:boolean
  hasHouseNumber?:boolean
  source:'saved'|'geoapify'
}

type RemoteSuggestion=Omit<PlaceAutocompleteSelection,'source'>

export default function PlaceAutocomplete({
  id,label,value,onChange,onSelect,tripId,localSuggestions=[],placeholder,required=false,className='',
}:{
  id:string
  label:string
  value:string
  onChange:(value:string)=>void
  onSelect?:(selection:PlaceAutocompleteSelection)=>void
  tripId:string
  localSuggestions?:PlaceAutocompleteOption[]
  placeholder?:string
  required?:boolean
  className?:string
}){
  const listId=useId()
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [typedQuery,setTypedQuery]=useState('')
  const [remoteSuggestions,setRemoteSuggestions]=useState<RemoteSuggestion[]>([])
  const [providerActive,setProviderActive]=useState(false)
  const [open,setOpen]=useState(false)
  const [loading,setLoading]=useState(false)
  const [statusMessage,setStatusMessage]=useState('')
  const [activeIndex,setActiveIndex]=useState(-1)

  useEffect(()=>{
    const query=typedQuery.trim()
    if(query.length<3){setRemoteSuggestions([]);setProviderActive(false);setLoading(false);setStatusMessage('');return}
    const controller=new AbortController()
    let timedOut=false
    const timer=setTimeout(async()=>{
      setLoading(true)
      setStatusMessage('')
      const requestTimeout=setTimeout(()=>{timedOut=true;controller.abort()},8000)
      try{
        const params=new URLSearchParams({q:query,tripId})
        const response=await fetch(`/api/places/autocomplete?${params}`,{signal:controller.signal})
        const payload=await response.json() as {provider?:string|null;suggestions?:RemoteSuggestion[];message?:string}
        if(!response.ok)throw new Error(payload.message || 'No pudimos buscar lugares.')
        setProviderActive(payload.provider==='geoapify')
        setRemoteSuggestions(payload.suggestions || [])
        setStatusMessage(payload.message || (payload.provider==='geoapify' && !payload.suggestions?.length
          ?'No encontramos coincidencias. Podés escribir el lugar manualmente.'
          :''))
      }catch(error){
        if(timedOut){
          setProviderActive(false);setRemoteSuggestions([])
          setStatusMessage('La búsqueda tardó demasiado. Podés escribir el lugar manualmente.')
        }else if((error as Error).name!=='AbortError'){
          setProviderActive(false);setRemoteSuggestions([])
          setStatusMessage((error as Error).message || 'No pudimos buscar lugares.')
        }
      }finally{
        clearTimeout(requestTimeout)
        if(!controller.signal.aborted)setLoading(false)
        else if(timedOut)setLoading(false)
      }
    },300)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[typedQuery,tripId])

  const suggestions=useMemo<PlaceAutocompleteSelection[]>(()=>{
    const normalized=value.trim().toLocaleLowerCase('es')
    const local=localSuggestions
      .filter(place=>!normalized || `${place.name} ${place.address || ''}`.toLocaleLowerCase('es').includes(normalized))
      .map(place=>({
        id:place.id,name:place.name,address:place.address || '',
        value:[place.name,place.address].filter(Boolean).join(', '),
        latitude:place.latitude ?? undefined,longitude:place.longitude ?? undefined,source:'saved' as const,
      }))
    const combined=[...local,...remoteSuggestions.map(place=>({...place,source:'geoapify' as const}))]
    const seen=new Set<string>()
    return combined.filter(place=>{
      const key=place.value.toLocaleLowerCase('es')
      if(!key || seen.has(key))return false
      seen.add(key)
      return true
    }).slice(0,5)
  },[localSuggestions,remoteSuggestions,value])

  useEffect(()=>{
    setActiveIndex(current=>suggestions.length?Math.min(Math.max(current,0),suggestions.length-1):-1)
  },[suggestions.length])

  function selectPlace(selection:PlaceAutocompleteSelection){
    if(closeTimer.current)clearTimeout(closeTimer.current)
    onChange(selection.value)
    onSelect?.(selection)
    setTypedQuery('')
    setRemoteSuggestions([])
    setStatusMessage('')
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event:KeyboardEvent<HTMLInputElement>){
    if(event.key==='ArrowDown'){
      event.preventDefault();setOpen(true);setActiveIndex(current=>Math.min(current+1,suggestions.length-1))
    }else if(event.key==='ArrowUp'){
      event.preventDefault();setActiveIndex(current=>Math.max(current-1,0))
    }else if(event.key==='Enter' && open && activeIndex>=0 && suggestions[activeIndex]){
      event.preventDefault();selectPlace(suggestions[activeIndex])
    }else if(event.key==='Escape'){
      setOpen(false);setActiveIndex(-1)
    }
  }

  const showMenu=open && (suggestions.length>0 || Boolean(statusMessage))
  return <div className={`field place-autocomplete ${className}`.trim()}>
    <label htmlFor={id}>{label}</label>
    <div className="place-autocomplete-control">
      <input
        id={id}
        value={value}
        onChange={event=>{onChange(event.target.value);setTypedQuery(event.target.value);setOpen(true)}}
        onFocus={()=>{if(closeTimer.current)clearTimeout(closeTimer.current);setOpen(true)}}
        onBlur={()=>{closeTimer.current=setTimeout(()=>setOpen(false),120)}}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showMenu}
        aria-controls={showMenu?listId:undefined}
        aria-activedescendant={activeIndex>=0?`${listId}-${activeIndex}`:undefined}
      />
      {loading&&<LoaderCircle className="place-autocomplete-spinner" size={18} aria-label="Buscando lugares"/>}
    </div>
    {showMenu&&<div id={listId} className="place-suggestions" role="listbox">
      {suggestions.map((suggestion,index)=><button
        id={`${listId}-${index}`}
        key={`${suggestion.source}-${suggestion.id}`}
        type="button"
        role="option"
        aria-selected={activeIndex===index}
        className={activeIndex===index?'active':''}
        onMouseDown={event=>event.preventDefault()}
        onClick={()=>selectPlace(suggestion)}
        onMouseEnter={()=>setActiveIndex(index)}
      >
        <MapPin size={16}/>
        <span><b>{suggestion.name || suggestion.value}</b>{suggestion.address&&suggestion.address!==suggestion.name?<small>{suggestion.address}</small>:null}</span>
        {suggestion.source==='saved'?<em>Guardado</em>:suggestion.approximate&&!suggestion.hasHouseNumber?<em className="approximate">Aprox.</em>:null}
      </button>)}
      {statusMessage&&<div className="place-suggestions-status" role="status">{statusMessage}</div>}
      {providerActive&&<div className="place-attribution">
        <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>
        <span>·</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </div>}
    </div>}
  </div>
}
