import { Activity, Expense, PackingItem, Place, Reservation, Trip } from './types'

export function mapTrip(row: any, memberNames: string[] = [], role?: Trip['role']): Trip {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    country: row.country || '',
    startDate: row.start_date,
    endDate: row.end_date,
    currency: row.currency || 'ARS',
    status: row.status || 'planning',
    memberNames,
    role,
  }
}

export function mapActivity(row: any): Activity {
  return {
    id: row.id,
    tripId: row.trip_id,
    date: row.date,
    startTime: row.start_time?.slice(0, 5) || undefined,
    endTime: row.end_time?.slice(0, 5) || undefined,
    title: row.title,
    category: row.category,
    place: row.place || undefined,
    address: row.address || undefined,
    notes: row.notes || undefined,
    url: row.url || undefined,
    estimatedCost: Number(row.estimated_cost || 0),
    actualCost: row.actual_cost == null ? null : Number(row.actual_cost),
    costScope: row.cost_scope || 'shared',
    status: row.status || 'planned',
    optional: Boolean(row.optional),
    position: Number(row.position || 0),
  }
}

export function activityToRow(activity: Activity) {
  return {
    trip_id: activity.tripId,
    date: activity.date,
    start_time: activity.startTime || null,
    end_time: activity.endTime || null,
    title: activity.title,
    category: activity.category,
    place: activity.place || null,
    address: activity.address || null,
    notes: activity.notes || null,
    url: activity.url || null,
    estimated_cost: activity.estimatedCost || 0,
    actual_cost: activity.actualCost ?? null,
    cost_scope: activity.costScope,
    status: activity.status,
    optional: Boolean(activity.optional),
    position: activity.position || 0,
  }
}

export function mapExpense(row: any): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    activityId: row.activity_id || null,
    title: row.title,
    category: row.category,
    amount: Number(row.amount || 0),
    currency: row.currency || 'ARS',
    status: row.status || 'estimated',
    scope: row.scope || 'shared',
    included: row.included !== false,
  }
}

export function mapReservation(row: any): Reservation {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    status: row.status || 'pending',
    priority: row.priority || 'medium',
    dueDate: row.due_date || undefined,
    notes: row.notes || undefined,
    amount: row.amount == null ? undefined : Number(row.amount),
    position: Number(row.position || 0),
  }
}

export function mapPacking(row: any): PackingItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    label: row.label,
    assignedTo: row.assigned_label || 'Compartido',
    packed: Boolean(row.packed),
    category: row.category || 'General',
  }
}

export function mapPlace(row: any): Place {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    category: row.category || 'General',
    address: row.address || undefined,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    url: row.url || undefined,
    notes: row.notes || undefined,
    status: row.status || 'saved',
    isBase: Boolean(row.is_base),
  }
}
