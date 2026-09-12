import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  countryBiasCode,
  mapGeoapifySuggestions,
  normalizePlaceQuery,
  type GeoapifyAutocompleteResult,
  type RemotePlaceSuggestion,
} from '@/lib/place-autocomplete'

const requestWindows=new Map<string,{count:number;resetAt:number}>()
const responseCache=new Map<string,{expiresAt:number;suggestions:RemotePlaceSuggestion[]}>()
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

function cacheSuggestions(key:string,suggestions:RemotePlaceSuggestion[]){
  if(responseCache.size>=250){
    const oldest=responseCache.keys().next().value
    if(oldest)responseCache.delete(oldest)
  }
  responseCache.set(key,{expiresAt:Date.now()+CACHE_TTL_MS,suggestions})
}

function timingHeaders(startedAt:number,cache:'HIT'|'MISS',timings:Record<string,number>={}){
  const entries=[...Object.entries(timings),['total',performance.now()-startedAt] as const]
    .map(([name,duration])=>`${name};dur=${duration.toFixed(1)}`)
    .join(', ')
  return {'Cache-Control':'private, no-store','Server-Timing':entries,'X-TripMate-Places-Cache':cache}
}

export async function GET(request:Request){
  const startedAt=performance.now()
  const timings:Record<string,number>={}
  const apiKey=process.env.GEOAPIFY_API_KEY
  if(!apiKey)return NextResponse.json({provider:null,suggestions:[]})

  const requestUrl=new URL(request.url)
  const query=normalizePlaceQuery(requestUrl.searchParams.get('q') || '')
  const tripId=(requestUrl.searchParams.get('tripId') || '').trim()
  if(query.length<3)return NextResponse.json({provider:'geoapify',suggestions:[]})
  if(query.length>120 || !tripId){
    return NextResponse.json({message:'La búsqueda no es válida.'},{status:400})
  }

  const supabase=await createServerSupabaseClient()
  if(!supabase)return NextResponse.json({message:'El servicio no está configurado.'},{status:503})
  const authStartedAt=performance.now()
  const {data:claimsData,error:claimsError}=await supabase.auth.getClaims()
  timings.auth=performance.now()-authStartedAt
  const userId=typeof claimsData?.claims?.sub==='string'?claimsData.claims.sub:''
  if(claimsError || !userId)return NextResponse.json({message:'Necesitás iniciar sesión.'},{status:401})
  if(!consumeRequest(userId)){
    return NextResponse.json({message:'Esperá un momento antes de buscar nuevamente.'},{status:429})
  }

  const tripCacheKey=`${userId}:${tripId}`
  const cachedTrip=tripContextCache.get(tripCacheKey)
  let tripContext=cachedTrip && cachedTrip.expiresAt>Date.now()?cachedTrip:null
  if(!tripContext){
    const tripStartedAt=performance.now()
    const {data:trip,error:tripError}=await supabase
      .from('trips')
      .select('country')
      .eq('id',tripId)
      .maybeSingle()
    if(tripError || !trip)return NextResponse.json({message:'No se encontró el viaje.'},{status:404})
    timings.trip=performance.now()-tripStartedAt
    tripContext={expiresAt:Date.now()+TRIP_CONTEXT_TTL_MS,country:String(trip.country || '').trim()}
    tripContextCache.set(tripCacheKey,tripContext)
  }

  const cacheKey=`${tripId}:${query.toLocaleLowerCase('es')}`
  const cached=responseCache.get(cacheKey)
  if(cached && cached.expiresAt>Date.now()){
    return NextResponse.json({provider:'geoapify',suggestions:cached.suggestions},{headers:timingHeaders(startedAt,'HIT',timings)})
  }
  if(cached)responseCache.delete(cacheKey)

  const geoapifyUrl=new URL('https://api.geoapify.com/v1/geocode/autocomplete')
  geoapifyUrl.searchParams.set('text',query)
  geoapifyUrl.searchParams.set('format','json')
  geoapifyUrl.searchParams.set('lang','es')
  geoapifyUrl.searchParams.set('limit','5')
  const countryCode=countryBiasCode(tripContext.country)
  if(countryCode)geoapifyUrl.searchParams.set('bias',`countrycode:${countryCode}`)
  geoapifyUrl.searchParams.set('apiKey',apiKey)

  try{
    const providerStartedAt=performance.now()
    const response=await fetch(geoapifyUrl,{cache:'no-store',signal:AbortSignal.timeout(5000)})
    timings.provider=performance.now()-providerStartedAt
    if(!response.ok){
      const message=response.status===401 || response.status===403
        ?'Geoapify rechazó la clave configurada.'
        :'No pudimos consultar lugares.'
      return NextResponse.json({message},{status:502})
    }
    const payload=await response.json() as {results?:GeoapifyAutocompleteResult[]}
    const suggestions=mapGeoapifySuggestions(payload.results || [],query)
    cacheSuggestions(cacheKey,suggestions)
    return NextResponse.json({provider:'geoapify',suggestions},{headers:timingHeaders(startedAt,'MISS',timings)})
  }catch{
    return NextResponse.json({message:'No pudimos consultar lugares.'},{status:502})
  }
}
