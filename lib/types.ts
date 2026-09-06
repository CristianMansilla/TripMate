export type TripStatus = 'planning' | 'active' | 'completed'
export type ActivityStatus = 'idea' | 'planned' | 'reserved' | 'paid' | 'done'
export type CostScope = 'shared' | 'per_person'
export type TripRole = 'owner' | 'editor' | 'viewer'
export type PlaceStatus = 'saved' | 'candidate' | 'confirmed' | 'discarded' | 'visited'

export type Trip = {
  id: string
  name: string
  destination: string
  country: string
  startDate: string
  endDate: string
  currency: string
  status: TripStatus
  memberNames: string[]
  role?: TripRole
}

export type Activity = {
  id: string
  tripId: string
  date: string
  startTime?: string
  endTime?: string
  title: string
  category: 'transport' | 'lodging' | 'food' | 'activity' | 'museum' | 'nightlife' | 'event' | 'other'
  place?: string
  address?: string
  notes?: string
  url?: string
  estimatedCost: number
  actualCost?: number | null
  costScope: CostScope
  status: ActivityStatus
  optional?: boolean
  position?: number
}

export type Reservation = {
  id: string
  tripId: string
  title: string
  status: 'pending' | 'watching' | 'reserved' | 'paid'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  notes?: string
  amount?: number
  position?: number
}

export type Expense = {
  id: string
  tripId: string
  activityId?: string | null
  title: string
  category: string
  amount: number
  amountBasis?: 'per_person' | 'group'
  currency?: string
  status: 'estimated' | 'confirmed' | 'paid'
  scope: CostScope
  included?: boolean
  date?: string
  startTime?: string
  endTime?: string
  place?: string
  notes?: string
  optional?: boolean
}

export type PackingItem = {
  id: string
  tripId: string
  label: string
  assignedToId?: string | null
  assignedTo: string
  packed: boolean
  category: string
}

export type Place = {
  id: string
  tripId: string
  name: string
  category: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  url?: string
  notes?: string
  status: PlaceStatus
  isBase?: boolean
}

export type ChangeLogItem = {
  id: number
  tripId: string
  entityType: string
  entityId?: string | null
  action: string
  summary?: string | null
  actorName?: string | null
  createdAt: string
}
