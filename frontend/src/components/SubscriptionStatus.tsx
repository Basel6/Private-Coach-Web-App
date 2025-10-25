import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/lib/api'

interface Payment {
  id: number
  client_id: number
  amount: number
  currency: string
  duration_months: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
  paid_at: string | null
  active_until: string | null
  provider: string
  plan_id: string | null
  plan_name: string | null
  created_at: string
}

interface SubscriptionStatusProps {
  onNeedSubscription?: () => void
}

export default function SubscriptionStatus({ onNeedSubscription }: SubscriptionStatusProps) {
  const { user } = useAuthStore()
  const [subscription, setSubscription] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch user's payments to find active subscription
      const payments = await apiClient.get('/payments/me') as Payment[]
      
      // Find the most recent active subscription
      const now = new Date()
      const activeSubscription = payments
        .filter(payment => 
          payment.status === 'PAID' && 
          payment.active_until && 
          new Date(payment.active_until) > now
        )
        .sort((a, b) => new Date(b.active_until!).getTime() - new Date(a.active_until!).getTime())[0]

      setSubscription(activeSubscription || null)
    } catch (error) {
      console.error('Error fetching subscription status:', error)
      setError('Failed to load subscription status')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getStatusColor = (daysRemaining: number) => {
    if (daysRemaining <= 3) return 'text-red-600 bg-red-100'
    if (daysRemaining <= 7) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchSubscriptionStatus}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Subscription</h3>
          <p className="text-gray-600 mb-4">
            Subscribe to a plan to start booking training sessions with your coach.
          </p>
          <button
            onClick={onNeedSubscription}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View Subscription Plans
          </button>
        </div>
      </div>
    )
  }

  const daysRemaining = getDaysRemaining(subscription.active_until!)
  const statusColor = getStatusColor(daysRemaining)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Active Subscription</h3>
          <p className="text-sm text-gray-600">
            {subscription.plan_name || `${subscription.duration_months} Month${subscription.duration_months > 1 ? 's' : ''} Plan`}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Amount Paid</p>
          <p className="font-semibold">₪{subscription.amount}</p>
        </div>
        <div>
          <p className="text-gray-600">Provider</p>
          <p className="font-semibold capitalize">{subscription.provider}</p>
        </div>
        <div>
          <p className="text-gray-600">Paid On</p>
          <p className="font-semibold">
            {subscription.paid_at ? formatDate(subscription.paid_at) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Expires On</p>
          <p className="font-semibold">
            {subscription.active_until ? formatDate(subscription.active_until) : 'N/A'}
          </p>
        </div>
      </div>

      {daysRemaining <= 7 && daysRemaining > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Subscription Expiring Soon</p>
              <p className="text-sm text-yellow-700">
                Your subscription expires in {daysRemaining} day{daysRemaining > 1 ? 's' : ''}. 
                Renew now to continue booking sessions.
              </p>
              <button
                onClick={onNeedSubscription}
                className="mt-2 text-sm bg-yellow-600 text-white px-4 py-1 rounded hover:bg-yellow-700"
              >
                Renew Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {daysRemaining <= 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Subscription Expired</p>
              <p className="text-sm text-red-700">
                Your subscription has expired. Subscribe to a new plan to continue using our services.
              </p>
              <button
                onClick={onNeedSubscription}
                className="mt-2 text-sm bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}