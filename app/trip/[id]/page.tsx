import TripWorkspace from '@/components/TripWorkspace'
import { tripTabFromParam } from '@/lib/trip-navigation'

export default async function TripPage({
  params,
  searchParams,
}:PageProps<'/trip/[id]'>){
  const [{id},query]=await Promise.all([params,searchParams])
  return <TripWorkspace tripId={id} initialTab={tripTabFromParam(query.seccion)}/>
}
