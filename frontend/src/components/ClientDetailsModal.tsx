import { useMemo } from 'react'
import { formatCurrencyILS } from '@/lib/format'

interface PaymentTransaction {
  id: number
  client_id: number
  amount: number | string
  currency: string
  duration_months: number
  status: 'INITIATED' | 'REQUIRES_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELED' | 'EXPIRED'
  paid_at?: string
  active_until?: string
  provider?: string
  plan_id?: string
  plan_name?: string
  created_at?: string
}

interface ClientDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  client: {
    id: number
    username: string
    email: string
    first_name?: string
    last_name?: string
    phone?: string
    created_at: string
  } | null
  allPayments?: PaymentTransaction[] // Accept payments as prop instead of fetching them
}

export default function ClientDetailsModal({ isOpen, onClose, client, allPayments = [] }: ClientDetailsModalProps) {
  // Filter payments for this specific client
  const clientPayments = useMemo(() => {
    if (!client || !allPayments) return []
    return allPayments.filter(payment => payment.client_id === client.id)
  }, [client, allPayments])

  const activeSubscription = useMemo(() => {
    if (!clientPayments.length) return null
    
    const now = new Date()
    return clientPayments
      .filter(payment => 
        payment.status === 'PAID' && 
        payment.active_until && 
        new Date(payment.active_until) > now
      )
      .sort((a, b) => new Date(b.active_until!).getTime() - new Date(a.active_until!).getTime())[0]
  }, [clientPayments])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      case 'INITIATED': return 'bg-blue-100 text-blue-800'
      case 'REQUIRES_PAYMENT': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Check if client profile is incomplete
  const isClientProfileIncomplete = () => {
    if (!client) return false
    return !client.first_name || !client.last_name || !client.phone
  }

  const getMissingClientFields = () => {
    if (!client) return []
    const missing = []
    if (!client.first_name) missing.push('First Name')
    if (!client.last_name) missing.push('Last Name')
    if (!client.phone) missing.push('Phone Number')
    return missing
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Client Details</h2>
            {client && (
              <p className="text-sm text-gray-600 mt-1">
                {client.first_name || client.last_name 
                  ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                  : client.username
                }
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {client && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Client Information</h3>
                
                {/* Profile Completion Warning */}
                {isClientProfileIncomplete() && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-2">
                        <h4 className="text-xs font-medium text-red-800">
                          Incomplete Profile
                        </h4>
                        <p className="mt-1 text-xs text-red-700">
                          Missing: {getMissingClientFields().join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Username:</span>
                    <span className="ml-2 font-medium">{client.username}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-medium">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2 font-medium">{client.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Member since:</span>
                    <span className="ml-2 font-medium">{formatDate(client.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Active Subscription Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Subscription Status</h3>
                {activeSubscription ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        Active
                      </span>
                      <span className="text-sm text-gray-600">
                        {getDaysRemaining(activeSubscription.active_until!) > 0 
                          ? `${getDaysRemaining(activeSubscription.active_until!)} days remaining`
                          : 'Expired'
                        }
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>Plan: </span>
                      <span className="font-medium">{activeSubscription.plan_name}</span>
                      <span> • Expires: </span>
                      <span className="font-medium">{formatDate(activeSubscription.active_until!)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      No Active Subscription
                    </span>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Payment History</h3>
                
                {clientPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No payments found for this client.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {clientPayments
                      .sort((a: PaymentTransaction, b: PaymentTransaction) => 
                        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                      )
                      .map((payment: PaymentTransaction) => (
                        <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                {payment.status}
                              </span>
                              <span className="text-sm font-medium">{payment.plan_name}</span>
                            </div>
                            <span className="text-lg font-semibold text-gray-900">
                              {formatCurrencyILS(typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                            <div>
                              <span>Created: </span>
                              <span>{payment.created_at ? formatDateTime(payment.created_at) : 'N/A'}</span>
                            </div>
                            {payment.paid_at && (
                              <div>
                                <span>Paid: </span>
                                <span>{formatDateTime(payment.paid_at)}</span>
                              </div>
                            )}
                            {payment.active_until && (
                              <div>
                                <span>Valid until: </span>
                                <span>{formatDate(payment.active_until)}</span>
                              </div>
                            )}
                            <div>
                              <span>Duration: </span>
                              <span>{payment.duration_months} month{payment.duration_months > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}