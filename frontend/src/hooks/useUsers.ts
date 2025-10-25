import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// Types for our API responses
export interface User {
  id: number
  username: string
  email: string
  role: 'CLIENT' | 'COACH' | 'ACCOUNTANT'
  first_name?: string
  last_name?: string
  phone?: string
  created_at: string
  is_active: boolean
  shift_start_hour?: number
  shift_end_hour?: number
}

export interface CoachLimited {
  id: number
  username: string
  first_name?: string
  last_name?: string
  phone?: string
  shift_start_hour?: number
  shift_end_hour?: number
  specializations?: string[]
  rating?: number
}

export interface ClientLimited {
  id: number
  username: string
  email: string
  assigned_coach?: CoachLimited
}

// Enhanced client profile with membership info
export interface MembershipInfo {
  member_since?: string
  active_until?: string
  plan_name?: string
  status?: string
}

export interface ClientProfile {
  id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  created_at: string
  membership?: MembershipInfo
}

// ============ USER QUERIES ============

// Get current user profile
export const useCurrentUser = () => {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => apiClient.getCurrentUser(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get all coaches (for clients and accountants)
export const useCoaches = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['users', 'coaches'],
    queryFn: () => apiClient.get<CoachLimited[]>('/users/coaches'),
    enabled: user?.role === 'ACCOUNTANT' || user?.role === 'CLIENT',
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get all clients (for coaches and accountants)
export const useClients = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['users', 'clients'],
    queryFn: () => apiClient.get<ClientLimited[]>('/users/clients'),
    enabled: user?.role === 'ACCOUNTANT',
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get my clients (for coaches)
export const useMyClients = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['users', 'my-clients'],
    queryFn: () => apiClient.get<ClientLimited[]>('/users/my-clients'),
    enabled: user?.role === 'COACH',
    staleTime: 2 * 60 * 1000,
  })
}

// Get my coaches (for clients)
export const useMyCoaches = () => {
  const { user } = useAuthStore()
  
  console.log('useMyCoaches hook called', { 
    user: user ? { id: user.id, username: user.username, role: user.role } : null,
    enabled: user?.role === 'CLIENT'
  });
  
  return useQuery({
    queryKey: ['users', 'my-coaches'],
    queryFn: async () => {
      console.log('Fetching my coaches...');
      try {
        const result = await apiClient.get<CoachLimited[]>('/users/my-coaches');
        console.log('My coaches result:', result);
        return result;
      } catch (error) {
        console.error('Error fetching my coaches:', error);
        throw error;
      }
    },
    enabled: user?.role === 'CLIENT',
    staleTime: 2 * 60 * 1000,
  })
}

// Get client profile with membership info (for coaches)
export const useClientProfile = (clientId: number) => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['users', 'client-profile', clientId],
    queryFn: () => apiClient.get<ClientProfile>(`/users/client-profile/${clientId}`),
    enabled: user?.role === 'COACH' && clientId > 0,
    staleTime: 2 * 60 * 1000,
  })
}

// ============ USER MUTATIONS ============

// Update current user profile
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (userData: Partial<User>) => 
      apiClient.put<User>('/users/me', userData),
    onSuccess: (updatedUser) => {
      // Update the user cache
      queryClient.setQueryData(['user', 'me'], updatedUser)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Assign client to coach (for coaches)
export const useAssignClient = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (clientId: number) => 
      apiClient.post(`/users/assign-client/${clientId}`),
    onSuccess: () => {
      // Refresh client lists
      queryClient.invalidateQueries({ queryKey: ['users', 'my-clients'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'clients'] })
    },
  })
}

// Select coach for current user (for clients)
export const useSelectCoach = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (coachId: number) => 
      apiClient.post(`/users/select-coach/${coachId}`),
    onSuccess: () => {
      // Refresh user data and coach lists
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'my-coaches'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'coaches'] })
    },
  })
}

// Remove client from coach
export const useRemoveClient = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (clientId: number) => 
      apiClient.delete(`/users/remove-client/${clientId}`),
    onSuccess: () => {
      // Refresh client lists
      queryClient.invalidateQueries({ queryKey: ['users', 'my-clients'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'clients'] })
    },
  })
}

// Delete current user account
export const useDeleteAccount = () => {
  const { logout } = useAuthStore()
  
  return useMutation({
    mutationFn: () => apiClient.delete('/users/me'),
    onSuccess: () => {
      // Log user out after account deletion
      logout()
    },
  })
}

// Member statistics for landing page
export interface MemberStats {
  total_members: number
  active_members: number
}

// Get public member statistics (no auth required)
export const useMemberStats = () => {
  return useQuery({
    queryKey: ['users', 'member-stats'],
    queryFn: () => apiClient.get<MemberStats>('/users/stats/members'),
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
  })
}