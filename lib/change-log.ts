import { createClient } from './supabase-client'

export async function logChange(tripId: string, entityType: string, entityId: string | null, action: string, summary: string) {
  const supabase = createClient()
  if (!supabase) return
  const {data:{user}}=await supabase.auth.getUser()
  await supabase.from('change_log').insert({
    trip_id: tripId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    actor_id: user?.id || null,
  })
}
