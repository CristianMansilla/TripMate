export type GeoapifyAutocompleteResult = {
  place_id?: string
  name?: string
  formatted?: string
  address_line1?: string
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

export type RemotePlaceSuggestion = {
  id:string
  name:string
  address:string
  value:string
  latitude?:number
  longitude?:number
  approximate?:boolean
  hasHouseNumber?:boolean
}

const COUNTRY_CODES:Record<string,string>={
  argentina:'ar',bolivia:'bo',brasil:'br',brazil:'br',canada:'ca',chile:'cl',colombia:'co',
  ecuador:'ec',espana:'es',spain:'es',estadosunidos:'us',unitedstates:'us',francia:'fr',
  france:'fr',alemania:'de',germany:'de',italia:'it',italy:'it',mexico:'mx',paraguay:'py',
  peru:'pe',portugal:'pt',reinounido:'gb',unitedkingdom:'gb',uruguay:'uy',venezuela:'ve',
}

function normalizedToken(value:string){
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^a-z]/g,'')
}

export function normalizePlaceQuery(value:string){
  return value.trim().replace(/\s+/g,' ')
}

export function countryBiasCode(country:string){
  return COUNTRY_CODES[normalizedToken(country)]
}

function displayCity(value:string|undefined){
  return String(value || '').trim().replace(/^Municipio de\s+/i,'')
}

export function mapGeoapifySuggestions(results:GeoapifyAutocompleteResult[],query:string,limit=5){
  const seen=new Set<string>()
  const requestedHouseNumber=query.match(/\b\d+[a-z]?\b/i)?.[0]?.toLocaleLowerCase('es')
  return results.flatMap((result,index):RemotePlaceSuggestion[]=>{
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
      id:result.place_id || `geoapify-${index}`,name,address,value,
      latitude:Number.isFinite(result.lat)?result.lat:undefined,
      longitude:Number.isFinite(result.lon)?result.lon:undefined,
      approximate,hasHouseNumber:Boolean(result.housenumber),
    }]
  }).slice(0,limit)
}
