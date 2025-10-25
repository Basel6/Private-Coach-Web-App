import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// Types for workout-related data
export interface Exercise {
  id: number
  name: string
  description: string
  muscle_groups: string[]
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  equipment_needed: string[]
}

export interface WorkoutTemplate {
  id: number
  name: string
  description: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  duration_minutes: number
  exercises: Exercise[]
  created_by_coach_id: number
  created_at: string
}

export interface AssignedWorkout {
  id: number
  client_id: number
  coach_id: number
  workout_template_id: number
  assigned_date: string
  due_date?: string
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  notes?: string
  workout_template: WorkoutTemplate
}

export interface CreateWorkoutRequest {
  name: string
  description: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  duration_minutes: number
  exercise_ids: number[]
}

export interface AssignWorkoutRequest {
  client_id: number
  workout_template_id: number
  due_date?: string
  notes?: string
}

// ============ WORKOUT QUERIES ============

// Get all workout templates (for coaches to assign, clients to view)
export const useWorkoutTemplates = () => {
  return useQuery({
    queryKey: ['workouts', 'templates'],
    queryFn: () => apiClient.get<WorkoutTemplate[]>('/workouts/templates'),
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
  })
}

// Get my workout templates (for coaches - ones they created)
export const useMyWorkoutTemplates = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['workouts', 'my-templates'],
    queryFn: () => apiClient.get<WorkoutTemplate[]>('/workouts/my-templates'),
    enabled: user?.role === 'COACH',
    staleTime: 5 * 60 * 1000,
  })
}

// Get assigned workouts (for clients - workouts assigned to them)
export const useAssignedWorkouts = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['workouts', 'assigned'],
    queryFn: () => apiClient.get<AssignedWorkout[]>('/workouts/assigned'),
    enabled: user?.role === 'CLIENT',
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get client workouts (for coaches - workouts they assigned to clients)
export const useClientWorkouts = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['workouts', 'client-workouts'],
    queryFn: () => apiClient.get<AssignedWorkout[]>('/workouts/client-workouts'),
    enabled: user?.role === 'COACH',
    staleTime: 2 * 60 * 1000,
  })
}

// Get all exercises (for creating workout templates)
export const useExercises = () => {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: () => apiClient.get<Exercise[]>('/workouts/exercises'),
    staleTime: 10 * 60 * 1000, // 10 minutes - exercises rarely change
  })
}

// Get specific workout template
export const useWorkoutTemplate = (templateId: number) => {
  return useQuery({
    queryKey: ['workouts', 'templates', templateId],
    queryFn: () => apiClient.get<WorkoutTemplate>(`/workouts/templates/${templateId}`),
    enabled: !!templateId,
  })
}

// ============ WORKOUT MUTATIONS ============

// Create workout template (for coaches)
export const useCreateWorkoutTemplate = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (workoutData: CreateWorkoutRequest) =>
      apiClient.post<WorkoutTemplate>('/workouts/templates', workoutData),
    onSuccess: () => {
      // Refresh workout template lists
      queryClient.invalidateQueries({ queryKey: ['workouts', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['workouts', 'my-templates'] })
    },
  })
}

// Assign workout to client (for coaches)
export const useAssignWorkout = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (assignmentData: AssignWorkoutRequest) =>
      apiClient.post<AssignedWorkout>('/workouts/assign', assignmentData),
    onSuccess: () => {
      // Refresh assigned workout lists
      queryClient.invalidateQueries({ queryKey: ['workouts', 'assigned'] })
      queryClient.invalidateQueries({ queryKey: ['workouts', 'client-workouts'] })
    },
  })
}

// Update workout status (for clients - mark as completed, in progress, etc.)
export const useUpdateWorkoutStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ 
      workoutId, 
      status, 
      notes 
    }: { 
      workoutId: number
      status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
      notes?: string 
    }) =>
      apiClient.put(`/workouts/assigned/${workoutId}`, { status, notes }),
    onSuccess: () => {
      // Refresh workout lists
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
    },
  })
}

// Delete workout template (for coaches)
export const useDeleteWorkoutTemplate = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (templateId: number) =>
      apiClient.delete(`/workouts/templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['workouts', 'my-templates'] })
    },
  })
}

// ============ NEW WORKOUT TEMPLATE FEATURES ============

// New types for workout templates from database
export interface DbWorkoutTemplate {
  id: number
  name: string
  description: string
  muscle_group: string
  sets: number
  reps: string
  picture_url?: string
  video_url?: string
}

export interface BookingWorkoutSuggestion {
  workout_day: string
  muscle_groups: string[]
  templates: DbWorkoutTemplate[]
  total_templates: number
  message?: string
}

// Get all workout templates from database (public)
export const useDbWorkoutTemplates = (muscleGroup?: string) => {
  return useQuery({
    queryKey: ['workout-templates-db', muscleGroup],
    queryFn: async () => {
      const url = muscleGroup && muscleGroup !== 'All'
        ? `/workouts/templates/public?muscle_group=${muscleGroup}`
        : '/workouts/templates/public'
      return apiClient.get<DbWorkoutTemplate[]>(url)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get workout templates for specific booking
export const useBookingWorkoutTemplates = (bookingId: number, enabled = true) => {
  return useQuery({
    queryKey: ['booking-workout-templates', bookingId],
    queryFn: () => apiClient.get<BookingWorkoutSuggestion>(`/workouts/booking/${bookingId}/suggested-templates`),
    enabled: enabled && !!bookingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}