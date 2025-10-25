import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// Types for user info in bookings
export interface BookingUserInfo {
  id: number
  username: string
  first_name?: string
  last_name?: string
  email: string
}

// Types for booking-related data
export interface BookingSession {
  id: number
  client_id: number
  coach_id: number
  date: string // ISO datetime string from backend
  status: string // 'pending', 'confirmed', 'completed', 'cancelled'
  plan?: string
  workout?: string
  coach_decision_requested?: string
  coach_notes?: string
  slot_id?: number
  ai_generated?: boolean
  
  // Related user information
  client?: BookingUserInfo
  coach?: BookingUserInfo
}

export interface CreateBookingRequest {
  client_id: number
  coach_id: number
  date: string // ISO datetime string
  plan?: string
}

export interface UpdateBookingRequest {
  session_date?: string
  session_time?: string
  duration_minutes?: number
  status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  notes?: string
}

// Types for schedule slots and AI booking
export interface ScheduleSlot {
  id: number
  date: string
  hour: number
  coach_id: number
  is_available: boolean
}

export interface AISuggestionRequest {
  client_id: number
  num_sessions: number
  preferred_date_start?: string
  days_flexibility?: number
  preferred_times?: number[]
}

export interface AISuggestion {
  slot_id: number
  date: string
  hour: number
  coach_id: number
  confidence_score: number
  date_suggestion: string
}

export interface AISuggestionResponse {
  message: string
  suggestions: AISuggestion[]
  total_suggestions: number
  client_id: number
  solver_status: string
  solve_time_ms: number
  confidence_score: number
  session_token: string
  expires_at: string
}

export interface ReSuggestionRequest {
  session_token: string
  client_id: number
  keep_suggestions: AISuggestion[]
  replace_count: number
  preferred_date?: string
  days_flexibility?: number
}

export interface BookSelectedRequest {
  session_token: string
  selected_slot_ids: number[]
}

// ============ BOOKING QUERIES ============

// Get all my bookings (for clients and coaches)
export const useMyBookings = () => {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery({
    queryKey: ['bookings', 'my-bookings'],
    queryFn: () => apiClient.get<BookingSession[]>('/bookings/my-bookings'),
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000, // 1 minute - bookings change frequently
  })
}

// Get bookings as a client
export const useClientBookings = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['bookings', 'client-bookings'],
    queryFn: () => apiClient.get<BookingSession[]>('/bookings/client-bookings'),
    enabled: user?.role === 'CLIENT',
    staleTime: 1 * 60 * 1000,
  })
}

// Get bookings as a coach
export const useCoachBookings = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['bookings', 'coach-bookings'],
    queryFn: () => apiClient.get<BookingSession[]>('/bookings/coach-bookings'),
    enabled: user?.role === 'COACH',
    staleTime: 1 * 60 * 1000,
  })
}

// Get pending bookings (for coaches to approve/reject)
export const usePendingBookings = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['bookings', 'pending'],
    queryFn: () => apiClient.get<BookingSession[]>('/bookings/pending'),
    enabled: user?.role === 'COACH',
    staleTime: 30 * 1000, // 30 seconds - very fresh for pending decisions
  })
}

// Get specific booking details
export const useBooking = (bookingId: number) => {
  return useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => apiClient.get<BookingSession>(`/bookings/${bookingId}`),
    enabled: !!bookingId,
  })
}

// ============ BOOKING MUTATIONS ============

// Create a new booking (for clients)
export const useCreateBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (bookingData: CreateBookingRequest) => {
      console.log('Creating booking with data:', bookingData);
      try {
        const result = await apiClient.post<BookingSession>('/bookings/', bookingData);
        console.log('Booking created successfully:', result);
        return result;
      } catch (error) {
        console.error('Booking creation failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Refresh all booking-related queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

// Update booking (for both clients and coaches)
export const useUpdateBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBookingRequest }) =>
      apiClient.put<BookingSession>(`/bookings/${id}`, data),
    onSuccess: (_, variables) => {
      // Update specific booking and refresh lists
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

// Update booking workout day
export const useUpdateBookingWorkout = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ bookingId, workoutDay }: { bookingId: number; workoutDay: string }) =>
      apiClient.put(`/bookings/${bookingId}/workout`, { workout_day: workoutDay }),
    onSuccess: (_, variables) => {
      // Update specific booking and refresh lists
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

// Cancel booking
export const useCancelBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.delete(`/bookings/${bookingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my-bookings'] })
    },
  })
}

// Approve booking (for coaches)
export const useApproveBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ bookingId, coachNotes }: { bookingId: number, coachNotes?: string }) => {
      console.log('API call: Approving booking', bookingId, 'with notes:', coachNotes)
      console.log('Full URL will be:', `http://localhost:8000/bookings/${bookingId}`)
      console.log('Request body:', { status: 'confirmed', coach_notes: coachNotes })
      
      try {
        const result = await apiClient.put(`/bookings/${bookingId}`, { 
          status: 'confirmed',
          coach_notes: coachNotes || null
        })
        console.log('Approval result:', result)
        return result
      } catch (error) {
        console.error('Approval failed with error:', error)
        throw error
      }
    },
    onSuccess: () => {
      console.log('Booking approved, refreshing queries')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
    },
  })
}

// Reject booking (for coaches)
export const useRejectBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (bookingId: number) => {
      console.log('API call: Rejecting booking', bookingId)
      return apiClient.put(`/bookings/${bookingId}`, { status: 'cancelled' })
    },
    onSuccess: () => {
      console.log('Booking rejected, refreshing queries')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
    },
  })
}

// Mark booking as completed (for coaches)
export const useCompleteBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.put(`/bookings/${bookingId}`, { status: 'COMPLETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

// ============ SCHEDULE SLOTS QUERIES ============

// Get available schedule slots
export const useAvailableSlots = (dateFrom?: string, dateTo?: string, coachId?: number) => {
  return useQuery({
    queryKey: ['schedule-slots', dateFrom, dateTo, coachId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (coachId) params.append('coach_id', coachId.toString())
      params.append('available_only', 'true')
      
      return apiClient.get<ScheduleSlot[]>(`/schedule/slots?${params}`)
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// ============ AI BOOKING MUTATIONS ============

// Generate AI booking suggestions
export const useGenerateAISuggestions = () => {
  return useMutation({
    mutationFn: async (request: AISuggestionRequest) => {
      console.log('Generating AI suggestions with request:', request)
      
      try {
        // Build query parameters for the backend
        const params = new URLSearchParams({
          client_id: request.client_id.toString(),
          num_sessions: request.num_sessions.toString(),
          days_flexibility: request.days_flexibility?.toString() || '7'
        })
        
        // Add preferred_date if provided (backend expects 'preferred_date', frontend sends 'preferred_date_start')
        if (request.preferred_date_start) {
          params.append('preferred_date', request.preferred_date_start)
        }
        
        console.log('🔍 AI Suggestions Request Details:', {
          url: `/schedule/suggestions/booking?${params.toString()}`,
          client_id: request.client_id,
          preferred_date_start: request.preferred_date_start,
          num_sessions: request.num_sessions,
          days_flexibility: request.days_flexibility,
          parsedDate: new Date(request.preferred_date_start || ''),
          dayOfWeek: new Date(request.preferred_date_start || '').getDay()
        })
        
        // Use POST with query parameters (as backend expects)
        const response = await apiClient.post<AISuggestionResponse>(`/schedule/suggestions/booking?${params.toString()}`, {})
        console.log('AI suggestions response:', response)
        return response
      } catch (error) {
        console.error('Failed to generate AI suggestions:', error)
        throw error
      }
    },
  })
}

// Re-suggest alternatives
export const useReSuggestAlternatives = () => {
  return useMutation({
    mutationFn: async (request: ReSuggestionRequest) => {
      console.log('Re-suggesting with request:', request)
      
      try {
        const response = await apiClient.post<AISuggestionResponse>('/schedule/suggestions/re-suggest', request)
        console.log('Re-suggestion response:', response)
        return response
      } catch (error) {
        console.error('Failed to re-suggest:', error)
        throw error
      }
    },
  })
}

// Book selected suggestions
export const useBookSelected = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: BookSelectedRequest) => {
      console.log('Booking selected slots with request:', request)
      
      try {
        const response = await apiClient.post('/schedule/bookings/book-selected', request)
        console.log('Book selected response:', response)
        return response
      } catch (error) {
        console.error('Failed to book selected slots:', error)
        throw error
      }
    },
    onSuccess: () => {
      // Refresh bookings after successful booking
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['schedule-slots'] })
    },
  })
}

// Individual re-suggestion for a specific slot
export const useReSuggestIndividual = () => {
  return useMutation({
    mutationFn: async ({ sessionToken, slotId }: { sessionToken: string; slotId: number }) => {
      console.log('Re-suggesting individual slot:', slotId, 'with session:', sessionToken)
      
      try {
        // Use the dedicated individual re-suggestion endpoint
        const response = await apiClient.post(`/schedule/suggestions/re-suggest-individual`, {
          session_token: sessionToken,
          slot_id: slotId
        })
        console.log('Individual re-suggestion response:', response)
        return response
      } catch (error) {
        console.error('Failed to re-suggest individual slot:', error)
        throw error
      }
    },
  })
}

// Bulk re-suggestion for all slots in the session
export const useReSuggestAll = () => {
  return useMutation({
    mutationFn: async ({ sessionToken }: { sessionToken: string }) => {
      console.log('Re-suggesting all slots with session:', sessionToken)
      
      try {
        // Use the simplified session-based re-suggestion endpoint
        const response = await apiClient.get(`/schedule/suggestions/re-suggest-session?session_token=${sessionToken}`)
        console.log('Bulk re-suggestion response:', response)
        return response
      } catch (error) {
        console.error('Failed to re-suggest all slots:', error)
        throw error
      }
    },
  })
}