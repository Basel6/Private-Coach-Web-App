import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api'

interface User {
  id: number
  username: string
  email: string
  role: string
  first_name?: string
  last_name?: string
  phone?: string
  avatar?: string
  created_at: string
  is_active: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (userData: {
    email: string
    password: string
    full_name: string
    role: string
  }) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await apiClient.login(email, password)
          apiClient.setToken(response.access_token)
          
          // Fetch user data after successful login
          const user = await apiClient.getCurrentUser()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (userData) => {
        set({ isLoading: true })
        try {
          // Register user (only returns user data, no token)
          const user = await apiClient.register(userData)
          
          // Now login to get the token
          const loginResponse = await apiClient.login(userData.email, userData.password)
          apiClient.setToken(loginResponse.access_token)
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        apiClient.setToken(null)
        set({
          user: null,
          isAuthenticated: false,
        })
      },

      loadUser: async () => {
        const token = localStorage.getItem('token')
        if (!token) return

        set({ isLoading: true })
        try {
          apiClient.setToken(token)
          const user = await apiClient.getCurrentUser()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
          apiClient.setToken(null)
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)