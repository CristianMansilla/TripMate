export type TripStatus = 'planning' | 'active' | 'completed'
export type ActivityStatus = 'idea' | 'planned' | 'reserved' | 'paid' | 'done'
export type CostScope = 'shared' | 'per_person'
export type TripRole = 'owner' | 'editor' | 'viewer'
export type PlaceStatus = 'saved' | 'candidate' | 'confirmed' | 'discarded' | 'visited'

export type ActivityStep = {
  id?: string
  title: string
  amount: number
  startTime?: string
  endTime?: string
  place?: string
  notes?: string
  optional?: boolean
  position?: number
}

export type Trip = {
  id: string
  name: string
  destination: string
  country: string
  startDate: string
  endDate: string
  currency: string
  status: TripStatus
  travelerCount: number
  memberNames: string[]
  role?: TripRole
}

export type Activity = {
  id: string
  tripId: string
  updatedAt?: string
  expenseId?: string | null
  date: string
  startTime?: string
  endTime?: string
  title: string
  category: string
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
  steps?: ActivityStep[]
}

export type ExpenseOccurrence = {
  id?: string
  date: string
  startTime?: string
  endTime?: string
  steps?: ActivityStep[]
}

export type Reservation = {
  id: string
  tripId: string
  updatedAt?: string
  expenseId?: string | null
  title: string
  status: 'pending' | 'watching' | 'reserved' | 'paid'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  notes?: string
  amount?: number
  position?: number
}

export type ReservationCostChoice =
  | { mode: 'none' }
  | { mode: 'legacy'; amount: number }
  | { mode: 'existing'; expenseId: string }
  | { mode: 'new'; amount: number; amountBasis: 'per_person' | 'group' }

export type ReservationSaveInput = {
  reservation: Reservation
  cost: ReservationCostChoice
}

export type Expense = {
  id: string
  tripId: string
  updatedAt?: string
  activityId?: string | null
  title: string
  category: string
  amount: number
  amountBasis?: 'per_person' | 'group'
  occurrencePricing?: 'total' | 'per_occurrence'
  occurrences?: ExpenseOccurrence[]
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
