// hooks/useSchedule.ts
// React Query hooks for schedule, plans, and plan requests

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

// ============ TYPES ============

export interface ClientPlan {
  id: number
  client_id: number
  plan_type: 'AB' | 'ABC' | 'PPL' | 'FIVE_DAY'
  sessions_per_week: number
  assigned_coach_id: number
  created_at: string
  updated_at: string
  coach_name?: string
  coach_username?: string
}

export interface PlanRequest {
  id: number
  client_id: number
  coach_id: number
  message?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  response_message?: string
  created_at: string
  updated_at: string
}

export interface CreatePlanRequest {
  client_id: number
  coach_id: number
  message?: string
}

export interface UpdatePlanRequest {
  status: 'APPROVED' | 'REJECTED'
  response_message?: string
  plan_type?: 'AB' | 'ABC' | 'PPL' | 'FIVE_DAY'
}

// ============ PLAN QUERIES ============

// Get client's current plan
export const useMyPlan = () => {
  return useQuery({
    queryKey: ['schedule', 'my-plan'],
    queryFn: async () => {
      const response = await apiClient.get<ClientPlan[]>('/schedule/plans?client_id=me')
      return response.length > 0 ? response[0] : null // Return first plan or null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get client plans for coach
export const useCoachClientPlans = (coachId?: number) => {
  return useQuery({
    queryKey: ['schedule', 'plans', 'coach', coachId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (coachId) params.append('coach_id', coachId.toString())
      return apiClient.get<ClientPlan[]>(`/schedule/plans?${params}`)
    },
    enabled: !!coachId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// ============ PLAN REQUEST QUERIES ============

// Get plan requests for current user (client's requests or coach's pending requests)
export const useMyPlanRequests = () => {
  return useQuery({
    queryKey: ['schedule', 'plan-requests', 'my-requests'],
    queryFn: () => apiClient.get<PlanRequest[]>('/schedule/plan-requests/my-requests'),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Get pending plan requests for coach
export const usePendingPlanRequests = () => {
  return useQuery({
    queryKey: ['schedule', 'plan-requests', 'pending'],
    queryFn: () => apiClient.get<PlanRequest[]>('/schedule/plan-requests/pending'),
    staleTime: 30 * 1000, // 30 seconds for real-time updates
  })
}

// ============ PLAN REQUEST MUTATIONS ============

// Create plan request
export const useCreatePlanRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreatePlanRequest) =>
      apiClient.post<PlanRequest>('/schedule/plan-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'plan-requests'] })
    },
  })
}

// Update plan request (approve/reject)
export const useUpdatePlanRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: number; data: UpdatePlanRequest }) =>
      apiClient.put<PlanRequest>(`/schedule/plan-requests/${requestId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'plan-requests'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', 'plans'] })
    },
  })
}

// ============ HELPER FUNCTIONS ============

export const formatPlanType = (planType: string): string => {
  const planNames = {
    'AB': 'Upper/Lower Split (2x/week)',
    'ABC': 'Push/Pull/Legs (3x/week)',
    'PPL': 'Push/Pull/Legs (3x/week)',
    'FIVE_DAY': 'Five Day Split (5x/week)'
  }
  return planNames[planType as keyof typeof planNames] || planType
}

export const getPlanTypeColor = (planType: string): string => {
  const colors = {
    'AB': 'bg-blue-100 text-blue-800',
    'ABC': 'bg-green-100 text-green-800',
    'PPL': 'bg-purple-100 text-purple-800',
    'FIVE_DAY': 'bg-red-100 text-red-800'
  }
  return colors[planType as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

export const getRequestStatusColor = (status: string): string => {
  const colors = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'APPROVED': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800'
  }
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

// ============ CLIENT PREFERENCES ============

export interface ClientPreference {
  id: number
  client_id: number
  preferred_start_hour?: number
  preferred_end_hour?: number
  is_flexible: boolean
  created_at: string
  updated_at: string
}

export interface CreateClientPreference {
  client_id: number
  preferred_start_hour?: number
  preferred_end_hour?: number
  is_flexible: boolean
}

export interface UpdateClientPreference {
  preferred_start_hour?: number
  preferred_end_hour?: number
  is_flexible: boolean
}

// Get client's preference
export const useMyPreference = () => {
  return useQuery({
    queryKey: ['schedule', 'my-preference'],
    queryFn: async () => {
      const response = await apiClient.get('/schedule/preferences') as any
      console.log('My preference response:', response)
      // Handle different response structures - apiClient.get might return data directly or wrapped
      const data = Array.isArray(response) ? response : (response.data || response)
      return data && data.length > 0 ? data[0] as ClientPreference : null // Get first (should be only one for client)
    }
  })
}

// Create or update client preference
export const useCreateOrUpdatePreference = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (preference: CreateClientPreference | UpdateClientPreference) => {
      try {
        // Check if preference exists first
        const existing = await apiClient.get('/schedule/preferences') as any
        console.log('Existing preferences response:', existing)
        
        // Handle different response structures - apiClient.get might return data directly or wrapped
        const existingData = Array.isArray(existing) ? existing : (existing.data || existing)
        
        if (existingData && existingData.length > 0) {
          // Update existing
          const preferenceId = existingData[0].id
          const updateData: UpdateClientPreference = {
            preferred_start_hour: preference.preferred_start_hour,
            preferred_end_hour: preference.preferred_end_hour,
            is_flexible: preference.is_flexible
          }
          const response = await apiClient.put(`/schedule/preferences/${preferenceId}`, updateData) as any
          return Array.isArray(response) ? response : (response.data || response)
        } else {
          // Create new - ensure client_id is included
          const createData = preference as CreateClientPreference
          if (!createData.client_id) {
            throw new Error('client_id is required for creating preferences')
          }
          console.log('Creating new preference:', createData)
          const response = await apiClient.post('/schedule/preferences', createData) as any
          return Array.isArray(response) ? response : (response.data || response)
        }
      } catch (error) {
        console.error('Preference mutation error:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'my-preference'] })
    }
  })
}