import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

// Types for payment-related data
export interface PaymentTransaction {
  id: number
  client_id: number
  client_email: string
  client_phone?: string
  plan_id: string
  plan_name: string
  amount: string // Backend returns this as string
  currency: string
  duration_months: number
  status: 'INITIATED' | 'REQUIRES_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELED' | 'EXPIRED'
  paid_at?: string
  active_until?: string
  receipt_url?: string
  is_active: boolean
  provider?: string
  paypal_order_id?: string
  paypal_capture_id?: string
  created_at?: string
}

export interface PaymentSummary {
  total_earnings: number
  total_payments: number
  pending_payments: number
  completed_payments: number
  this_month_earnings: number
  last_month_earnings: number
}

export interface CreatePaymentRequest {
  coach_id: number
  booking_id?: number
  amount: number
  currency: string
  payment_method: 'PAYPAL'
}

export interface ManualPaymentRequest {
  client_id: number
  amount: number
  currency: string
  plan_name: string
  duration_months: number
  status: 'INITIATED' | 'PAID' | 'FAILED'
  paid_at?: string
  notes?: string
}

// ============ PAYMENT QUERIES ============

// Get payment history (for clients - their payments)
export const useMyPayments = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['payments', 'my-payments'],
    queryFn: () => apiClient.get<PaymentTransaction[]>('/payments/me'),
    enabled: user?.role === 'CLIENT',
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get earnings (for coaches - payments they received)
export const useMyEarnings = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['payments', 'my-earnings'],
    queryFn: () => apiClient.get<PaymentTransaction[]>('/payments/my-earnings'),
    enabled: user?.role === 'COACH',
    staleTime: 2 * 60 * 1000,
  })
}

// Create a mock payment summary from available data
export const usePaymentSummary = () => {
  const { user } = useAuthStore()
  const { data: allPayments } = useAllPayments()
  
  return useQuery({
    queryKey: ['payments', 'summary'],
    queryFn: async () => {
      console.log('PaymentSummary - All payments data:', allPayments)
      
      if (!allPayments) {
        console.log('PaymentSummary - No payments data available')
        return null
      }
      
      console.log('PaymentSummary - Processing', allPayments.length, 'payments')
      
      const completed = allPayments.filter(p => p.status === 'PAID')
      const pending = allPayments.filter(p => p.status === 'INITIATED' || p.status === 'REQUIRES_PAYMENT')
      const thisMonth = new Date()
      thisMonth.setDate(1)
      
      const thisMonthPayments = completed.filter(p => 
        p.created_at ? new Date(p.created_at) >= thisMonth : false
      )
      
      console.log('PaymentSummary - Completed payments:', completed.length)
      console.log('PaymentSummary - Pending payments:', pending.length)
      console.log('PaymentSummary - This month payments:', thisMonthPayments.length)
      console.log('PaymentSummary - This month start date:', thisMonth.toISOString())
      console.log('PaymentSummary - Sample payment dates:', completed.slice(0, 3).map(p => ({ id: p.id, created_at: p.created_at, amount: p.amount })))
      
      const summary = {
        total_earnings: completed.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0),
        completed_payments: completed.length,
        pending_payments: pending.length,
        this_month_earnings: thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0),
        last_month_earnings: 0 // Would need more complex logic to calculate
      }
      
      console.log('PaymentSummary - Final summary:', summary)
      console.log('PaymentSummary - Sample amounts:', completed.slice(0, 3).map(p => ({ amount: p.amount, type: typeof p.amount })))
      return summary
    },
    enabled: (user?.role === 'COACH' || user?.role === 'ACCOUNTANT') && !!allPayments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get payments for a specific client (for accountants)
export const useClientPayments = (clientId: number) => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['payments', 'client', clientId],
    queryFn: () => apiClient.get<PaymentTransaction[]>(`/payments/reports?client_id=${clientId}`),
    enabled: user?.role === 'ACCOUNTANT' && !!clientId,
    staleTime: 2 * 60 * 1000,
  })
}

// Get all payments across all clients (for accountants)
export const useAllPayments = () => {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['payments', 'all'],
    queryFn: async (): Promise<PaymentTransaction[]> => {
      console.log('useAllPayments - Making API call to /payments/all')
      try {
        const response = await apiClient.get<PaymentTransaction[]>('/payments/all')
        console.log('useAllPayments - API response:', response)
        return response
      } catch (error) {
        console.error('useAllPayments - API error:', error)
        throw error
      }
    },
    enabled: user?.role === 'ACCOUNTANT',
    staleTime: 2 * 60 * 1000,
  })
}

// Get payment details
export const usePayment = (paymentId: number) => {
  return useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => apiClient.get<PaymentTransaction>(`/payments/${paymentId}`),
    enabled: !!paymentId,
  })
}

// ============ PAYMENT MUTATIONS ============

// Create payment (for clients)
export const useCreatePayment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (paymentData: CreatePaymentRequest) =>
      apiClient.post<{ payment_url: string; payment_id: string }>('/payments/create', paymentData),
    onSuccess: () => {
      // Refresh payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

// Create manual payment (for accountants)
export const useCreateManualPayment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (paymentData: ManualPaymentRequest) => {
      console.log('Creating manual payment with data:', paymentData)
      
      try {
        const response = await apiClient.post<PaymentTransaction>('/payments/manual', paymentData)
        console.log('Manual payment created successfully:', response)
        return response
      } catch (error) {
        console.error('Failed to create manual payment:', error)
        throw error
      }
    },
    onSuccess: () => {
      // Refresh payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

// Export payments as CSV
export const useExportPaymentsCSV = () => {
  return useMutation({
    mutationFn: async (filters?: { client_id?: number; status?: string; from_date?: string; to_date?: string }) => {
      const params = new URLSearchParams()
      if (filters?.client_id) params.append('client_id', filters.client_id.toString())
      if (filters?.status) params.append('status', filters.status)
      if (filters?.from_date) params.append('from_date', filters.from_date)
      if (filters?.to_date) params.append('to_date', filters.to_date)
      
      const response = await fetch(`http://localhost:8000/payments/reports/export.csv?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to export CSV')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
  })
}

// Process PayPal payment
export const useProcessPayPalPayment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ paymentId, payerInfo }: { paymentId: string; payerInfo: any }) =>
      apiClient.post(`/payments/paypal/execute/${paymentId}`, payerInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

// Refund payment (for accountants)
export const useRefundPayment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (paymentId: number) =>
      apiClient.post(`/payments/${paymentId}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

// Update payment status (for system/admin use)
export const useUpdatePaymentStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ 
      paymentId, 
      status 
    }: { 
      paymentId: number
      status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
    }) =>
      apiClient.put(`/payments/${paymentId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}