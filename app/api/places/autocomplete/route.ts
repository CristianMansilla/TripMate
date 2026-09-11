import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type GeoapifyResult = {
  place_id?: string
  name?: string
  formatted?: string
  address_line1?: string
  address_line2?: string
  street?: string
  housenumber?: string
  city?: string
  state?: string
  country?: string
  lat?: number
  lon?: number
  rank?:{
    confidence?:number
    confidence_building_level?:number
    match_type?:string
  }
}

type PlaceSuggestion = {
  id:string
  name:string
  address:string
  value:string
  latitude?:number
  longitude?:number
  approximate?:boolean
  hasHouseNumber?:boolean
}

const requestWindows=new Map<string,{count:number;resetAt:number}>()
const responseCache=new Map<string,{expiresAt:number;suggestions:PlaceSuggestion[]}>()
const tripContextCache=new Map<string,{expiresAt:number;country:string}>()
const RATE_LIMIT=40
const RATE_WINDOW_MS=60_000
const CACHE_TTL_MS=5*60_000
const TRIP_CONTEXT_TTL_MS=60_000

function consumeRequest(userId:string){
  const now=Date.now()
  const current=requestWindows.get(userId)
  if(!current || current.resetAt<=now){
    requestWindows.set(userId,{count:1,resetAt:now+RATE_WINDOW_MS})
    return true
  }
  if(current.count>=RATE_LIMIT)return false
  current.count+=1
  return true
}

function cacheSuggestions(key:string,suggestions:PlaceSuggestion[]){
  if(responseCache.size>=250){
    const oldest=responseCache.keys().next().value
    if(oldest)responseCache.delete(oldest)
  }
  responseCache.set(key,{expiresAt:Date.now()+CACHE_TTL_MS,suggestions})
}

function displayCity(value:string|undefined){
  return String(value || '').trim().replace(/^Municipio de\s+/i,'')
}

export async function GET(request:Request){
  const apiKey=process.env.GEOAPIFY_API_KEY
  if(!apiKey)return NextResponse.json({provider:null,suggestions:[]})

  const requestUrl=new URL(request.url)
  const query=(requestUrl.searchParams.get('q') || '').trim().replace(/\s+/g,' ')
  const tripId=(requestUrl.searchParams.get('tripId') || '').trim()
  if(query.length<3)return NextResponse.json({provider:'geoapify',suggestions:[]})
  if(query.length>120 || !tripId){
    return NextResponse.json({message:'La búsqueda no es válida.'},{status:400})
  }

  const supabase=await createServerSupabaseClient()
  if(!supabase)return NextResponse.json({message:'El servicio no está configurado.'},{status:503})
  const {data:claimsData,error:claimsError}=await supabase.auth.getClaims()
  const userId=typeof claimsData?.claims?.sub==='string'?claimsData.claims.sub:''
  if(claimsError || !userId)return NextResponse.json({message:'Necesitás iniciar sesión.'},{status:401})
  if(!consumeRequest(userId)){
    return NextResponse.json({message:'Esperá un momento antes de buscar nuevamente.'},{status:429})
  }

  const tripCacheKey=`${userId}:${tripId}`
  const cachedTrip=tripContextCache.get(tripCacheKey)
  let tripContext=cachedTrip && cachedTrip.expiresAt>Date.now()?cachedTrip:null
  if(!tripContext){
    const {data:trip,error:tripError}=await supabase
      .from('trips')
      .select('country')
      .eq('id',tripId)
      .maybeSingle()
    if(tripError || !trip)return NextResponse.json({message:'No se encontró el viaje.'},{status:404})
    tripContext={expiresAt:Date.now()+TRIP_CONTEXT_TTL_MS,country:String(trip.country || '').trim()}
    tripContextCache.set(tripCacheKey,tripContext)
  }

  const cacheKey=`${tripId}:${query.toLocaleLowerCase('es')}`
  const cached=responseCache.get(cacheKey)
  if(cached && cached.expiresAt>Date.now()){
    return NextResponse.json({provider:'geoapify',suggestions:cached.suggestions})
  }
  if(cached)responseCache.delete(cacheKey)

  const queryLower=query.toLocaleLowerCase('es')
  const context=[tripContext.country]
    .map(value=>String(value || '').trim())
    .filter(value=>value && !queryLower.includes(value.toLocaleLowerCase('es')))
  const searchText=query.includes(',')?query:[query,...context].join(', ')
  const geoapifyUrl=new URL('https://api.geoapify.com/v1/geocode/autocomplete')
  geoapifyUrl.searchParams.set('text',searchText)
  geoapifyUrl.searchParams.set('format','json')
  geoapifyUrl.searchParams.set('lang','es')
  geoapifyUrl.searchParams.set('limit','5')
  geoapifyUrl.searchParams.set('apiKey',apiKey)

  try{
    let response=await fetch(geoapifyUrl,{cache:'no-store',signal:AbortSignal.timeout(6000)})
    if(!response.ok){
      const message=response.status===401 || response.status===403
        ?'Geoapify rechazó la clave configurada.'
        :'No pudimos consultar lugares.'
      return NextResponse.json({message},{status:502})
    }
    let payload=await response.json() as {results?:GeoapifyResult[]}
    if(!(payload.results || []).length && searchText!==query){
      geoapifyUrl.searchParams.set('text',query)
      response=await fetch(geoapifyUrl,{cache:'no-store',signal:AbortSignal.timeout(6000)})
      if(response.ok)payload=await response.json() as {results?:GeoapifyResult[]}
    }
    const seen=new Set<string>()
    const requestedHouseNumber=query.match(/\b\d+[a-z]?\b/i)?.[0]?.toLocaleLowerCase('es')
    const suggestions=(payload.results || []).flatMap((result,index)=>{
      const returnedHouseNumber=String(result.housenumber || '').trim().toLocaleLowerCase('es')
      const exactHouseNumber=Boolean(
        requestedHouseNumber
        && returnedHouseNumber===requestedHouseNumber
        && result.rank?.match_type==='full_match'
      )
      const lowConfidence=typeof result.rank?.confidence_building_level==='number'
        ?result.rank.confidence_building_level<0.9
        :typeof result.rank?.confidence==='number' && result.rank.confidence<0.9
      const approximate=!exactHouseNumber && lowConfidence
      const name=(result.name || result.address_line1 || result.formatted || '').trim()
      const streetAddress=result.street
        ?[result.street,result.housenumber].filter(Boolean).join(' ')
        :result.address_line1 || ''
      const addressParts=[
        result.name && streetAddress!==result.name?streetAddress:'',
        displayCity(result.city),result.state,result.country,
      ].map(value=>String(value || '').trim()).filter(Boolean)
      const address=addressParts.filter((value,partIndex)=>
        addressParts.findIndex(candidate=>candidate.toLocaleLowerCase('es')===value.toLocaleLowerCase('es'))===partIndex
      ).join(', ')
      const value=[name,address].filter(Boolean).join(', ')
      const dedupeKey=value.toLocaleLowerCase('es')
      if(!value || seen.has(dedupeKey))return []
      seen.add(dedupeKey)
      return [{
        id:result.place_id || `geoapify-${index}`,
        name,
        address,
        value,
        latitude:Number.isFinite(result.lat)?result.lat:undefined,
        longitude:Number.isFinite(result.lon)?result.lon:undefined,
        approximate,
        hasHouseNumber:Boolean(result.housenumber),
      }]
    }).slice(0,5)
    cacheSuggestions(cacheKey,suggestions)
    return NextResponse.json({provider:'geoapify',suggestions})
  }catch{
    return NextResponse.json({message:'No pudimos consultar lugares.'},{status:502})
  }
}
