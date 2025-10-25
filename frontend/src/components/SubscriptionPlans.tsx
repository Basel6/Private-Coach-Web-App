import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/lib/api'

interface Plan {
  id: string
  name: string
  months: number
  amount: number
  description?: string
}

interface SubscriptionPlansProps {
  onSubscriptionSuccess?: () => void
}

interface PayPalCreateResponse {
  checkout_url: string  // Backend returns "checkout_url", not "approval_url"
  payment: any
}

const PLANS: Plan[] = [
  {
    id: 'MONTHLY',
    name: 'Monthly Plan',
    months: 1,
    amount: 700.00,
    description: 'Perfect for trying out our services'
  },
  {
    id: 'QUARTERLY',
    name: '3 Months Plan',
    months: 3,
    amount: 1500.00,
    description: 'Best value for committed fitness goals'
  },
  {
    id: 'YEARLY',
    name: '1 Year Plan',
    months: 12,
    amount: 4000.00,
    description: 'Maximum savings for long-term commitment'
  }
]

export default function SubscriptionPlans({ onSubscriptionSuccess }: SubscriptionPlansProps) {
  const { user } = useAuthStore()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
    setError(null)
  }

  const handleSubscribe = async () => {
    if (!selectedPlan || !user) {
      setError('Please select a plan first')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      console.log('Creating PayPal payment for plan:', selectedPlan)
      
      // Create PayPal payment
      const response = await apiClient.post('/payments/checkout', {
        plan_id: selectedPlan,
        return_url: `${window.location.origin}/dashboard?payment=success`,
        cancel_url: `${window.location.origin}/dashboard?payment=cancelled`
      }) as PayPalCreateResponse

      console.log('PayPal payment response:', response)

      if (response.checkout_url) {
        // Redirect to PayPal for payment
        window.location.href = response.checkout_url
      } else {
        throw new Error('No checkout URL received from PayPal')
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      setError(error instanceof Error ? error.message : 'Failed to create payment')
    } finally {
      setIsProcessing(false)
    }
  }

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'MONTHLY': return 'border-blue-500 bg-blue-50'
      case 'QUARTERLY': return 'border-green-500 bg-green-50'
      case 'YEARLY': return 'border-purple-500 bg-purple-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  const getButtonColor = (planId: string) => {
    switch (planId) {
      case 'MONTHLY': return 'bg-blue-600 hover:bg-blue-700'
      case 'QUARTERLY': return 'bg-green-600 hover:bg-green-700'
      case 'YEARLY': return 'bg-purple-600 hover:bg-purple-700'
      default: return 'bg-gray-600 hover:bg-gray-700'
    }
  }

  const calculateMonthlySavings = (plan: Plan) => {
    const monthlyPrice = PLANS.find(p => p.id === 'MONTHLY')?.amount || 700
    const totalMonthlyPrice = monthlyPrice * plan.months
    const savings = totalMonthlyPrice - plan.amount
    return savings > 0 ? savings : 0
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Choose Your Subscription Plan</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id
          const savings = calculateMonthlySavings(plan)
          const monthlyEquivalent = plan.amount / plan.months

          return (
            <div
              key={plan.id}
              className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                isSelected 
                  ? getPlanColor(plan.id) 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => handlePlanSelect(plan.id)}
            >
              {/* Popular badge for quarterly */}
              {plan.id === 'QUARTERLY' && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-600 text-white px-3 py-1 text-xs font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Best value badge for yearly */}
              {plan.id === 'YEARLY' && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-3 py-1 text-xs font-medium rounded-full">
                    Best Value
                  </span>
                </div>
              )}

              <div className="text-center">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h4>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  ₪{plan.amount}
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  ₪{monthlyEquivalent.toFixed(0)}/month
                </div>
                
                {savings > 0 && (
                  <div className="text-sm font-medium text-green-600 mb-3">
                    Save ₪{savings} compared to monthly
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-4">
                  {plan.description}
                </p>

                <div className="text-xs text-gray-500">
                  {plan.months} month{plan.months > 1 ? 's' : ''} subscription
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="mt-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedPlan && (
        <div className="border-t pt-6">
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
            <div className="flex justify-between text-sm">
              <span>Selected Plan:</span>
              <span className="font-medium">
                {PLANS.find(p => p.id === selectedPlan)?.name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Duration:</span>
              <span>{PLANS.find(p => p.id === selectedPlan)?.months} months</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t pt-2 mt-2">
              <span>Total:</span>
              <span>₪{PLANS.find(p => p.id === selectedPlan)?.amount}</span>
            </div>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
              isProcessing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : selectedPlan 
                  ? getButtonColor(selectedPlan)
                  : 'bg-gray-400'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            ) : (
              <>
                Pay with PayPal - ₪{PLANS.find(p => p.id === selectedPlan)?.amount}
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            You will be redirected to PayPal to complete your payment securely.
          </p>
        </div>
      )}
    </div>
  )
}