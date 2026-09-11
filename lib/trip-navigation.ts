export const tripTabs = ['Resumen','Itinerario','Presupuesto','Reservas','Lugares','Valija','Integrantes'] as const

export type TripTab = typeof tripTabs[number]

const tabBySlug:Record<string,TripTab>={
  resumen:'Resumen',
  itinerario:'Itinerario',
  presupuesto:'Presupuesto',
  reservas:'Reservas',
  lugares:'Lugares',
  valija:'Valija',
  integrantes:'Integrantes',
}

const slugByTab:Record<TripTab,string>=Object.fromEntries(
  Object.entries(tabBySlug).map(([slug,tab])=>[tab,slug]),
) as Record<TripTab,string>

export function tripTabFromParam(value:string|string[]|undefined):TripTab{
  const slug=Array.isArray(value)?value[0]:value
  return slug?tabBySlug[slug.toLowerCase()] || 'Resumen':'Resumen'
}

export function tripTabSlug(tab:TripTab){
  return slugByTab[tab]
}

export function tripSectionPath(tripId:string,tab:TripTab,search=''){
  const params=new URLSearchParams(search)
  params.set('seccion',tripTabSlug(tab))
  return `/trip/${encodeURIComponent(tripId)}?${params.toString()}`
}
