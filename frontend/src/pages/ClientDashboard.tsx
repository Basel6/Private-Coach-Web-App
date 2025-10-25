import { useAuthStore } from '@/store/authStore'
import { 
  useMyBookings, 
  useMyPayments, 
  useMyCoaches,
  useCancelBooking
} from '@/hooks'
import { 
  useMyPlan, 
  useMyPlanRequests,
  formatPlanType, 
  getPlanTypeColor 
} from '@/hooks/useSchedule'
import { 
  DashboardCard, 
  StatCard, 
  LoadingCard, 
  EmptyState, 
  StatusBadge 
} from '@/components/ui/DashboardComponents'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import SubscriptionPlans from '@/components/SubscriptionPlans'
import { useState, useEffect } from 'react'

export default function ClientDashboard() {
  const { user, logout } = useAuthStore()
  const [showPlanDetails, setShowPlanDetails] = useState(false)
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false)
  
  // Check for payment status in URL (when returning from PayPal)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    
    if (paymentStatus === 'success') {
      // Show success message
      alert('Payment completed successfully! Your subscription is now active.')
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (paymentStatus === 'cancelled') {
      // Show cancelled message
      alert('Payment was cancelled. You can try again anytime.')
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])
  
  // Fetch client data using our hooks
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings()
  const { data: payments, isLoading: paymentsLoading } = useMyPayments()
  const { data: coaches, isLoading: coachesLoading } = useMyCoaches()
  const { data: myPlan, isLoading: planLoading } = useMyPlan()
  const { data: myPlanRequests } = useMyPlanRequests()
  
  // Cancel booking mutation
  const cancelBookingMutation = useCancelBooking()

  const handleLogout = () => {
    logout()
  }

  // Check if profile is incomplete
  const isProfileIncomplete = () => {
    if (!user) return false
    return !user.first_name || !user.last_name || !user.phone
  }

  // Handle cancelling a booking
  const handleCancelBooking = (bookingId: number) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      cancelBookingMutation.mutate(bookingId, {
        onSuccess: () => {
          alert('Booking cancelled successfully')
        },
        onError: (error: any) => {
          console.error('Error cancelling booking:', error)
          alert('Failed to cancel booking. Please try again.')
        }
      })
    }
  }

  // Calculate stats from data
  const hasPendingRequest = myPlanRequests && myPlanRequests.length > 0
  
  // Handle booking button click with plan checks
  const handleBookingClick = () => {
    // First check if user has a coach
    if (!coaches || coaches.length === 0) {
      alert("Choose your coach first, then request a plan.")
      return
    }
    
    // Then check plan status
    if (!myPlan && hasPendingRequest) {
      alert("Wait for your plan to get confirmed by your coach before booking sessions.")
      return
    }
    if (!myPlan && !hasPendingRequest) {
      alert("Request a plan from your coach please first.")
      return
    }
    window.location.href = '/booking'
  }

  const totalBookings = bookings?.length || 0
  const upcomingBookings = bookings?.filter(b => 
    b.date && new Date(b.date) > new Date() && b.status === 'confirmed'
  ).length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Private Coach Logo" className="h-10 w-10 rounded-xl object-contain" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Private Coach - Client Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-sm text-gray-600">
                  Welcome, {user?.username}
                </span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user?.role}
              </span>
              <button
                onClick={() => window.location.href = '/profile'}
                className="relative bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition duration-200 flex items-center gap-2"
                title={isProfileIncomplete() ? "Complete your profile - missing information!" : "View your profile"}
              >
                Profile
                {isProfileIncomplete() && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 items-center justify-center">
                      <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3"/>
                      </svg>
                    </span>
                  </span>
                )}
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition duration-200"
              >
                Home
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Overview with Workout Plan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <div className="lg:col-span-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              title="Total Sessions"
              value={totalBookings}
              subtitle="All time"
              icon={<span className="text-2xl">📅</span>}
            />
            <StatCard
              title="Upcoming Sessions"
              value={upcomingBookings}
              subtitle="Scheduled"
              icon={<span className="text-2xl">⏰</span>}
            />
          </div>

          {/* My Workout Plan Section - side by side with stats */}
          <div className="lg:col-span-2">
            {planLoading ? (
              <LoadingCard title="My Workout Plan" />
            ) : (
            <DashboardCard 
              title="My Workout Plan"
              action={
                myPlan ? (
                  <button
                    onClick={() => setShowPlanDetails(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    View Details
                  </button>
                ) : myPlanRequests && myPlanRequests.length > 0 ? (
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      Request Pending
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => window.location.href = '/booking'}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Request Plan
                  </button>
                )
              }
            >
              {myPlan ? (
                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <span className="text-2xl">💪</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-green-900">
                          {formatPlanType(myPlan.plan_type)}
                        </h3>
                        <p className="text-sm text-green-600">
                          {myPlan.sessions_per_week} sessions per week
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlanTypeColor(myPlan.plan_type)}`}>
                      {myPlan.plan_type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Plan Type:</span>
                      <span className="ml-2 font-medium text-gray-900">{myPlan.plan_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sessions/Week:</span>
                      <span className="ml-2 font-medium text-gray-900">{myPlan.sessions_per_week}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Assigned:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {new Date(myPlan.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Coach:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {myPlan.coach_name || myPlan.coach_username || 'Not assigned'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : myPlanRequests && myPlanRequests.length > 0 ? (
                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-100 rounded-full p-2">
                      <span className="text-2xl">⏳</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">Plan Request Pending</h3>
                      <p className="text-sm text-blue-600">Your request is being reviewed by your coach</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-md p-4 border border-blue-200 mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Request Details:</p>
                    <p className="text-sm text-blue-700">"{myPlanRequests[0].message}"</p>
                    <p className="text-xs text-blue-500 mt-2">
                      Submitted: {new Date(myPlanRequests[0].created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {coaches && coaches.length > 0 && (
                    <div className="bg-white rounded-md p-3 border border-blue-200">
                      <p className="text-sm font-medium text-blue-900">Coach:</p>
                      <p className="text-sm text-blue-700">
                        {coaches[0].first_name} {coaches[0].last_name} (@{coaches[0].username})
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-amber-100 rounded-full p-2">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-amber-900">No Workout Plan</h3>
                      <p className="text-sm text-amber-600">You need a plan to start booking sessions</p>
                    </div>
                  </div>
                  <p className="text-sm text-amber-700 mb-4">
                    Request a workout plan from your coach to get started with your fitness journey. 
                    Your coach will create a personalized plan based on your goals and experience.
                  </p>
                  {coaches && coaches.length > 0 && (
                    <div className="bg-white rounded-md p-3 border border-amber-200">
                      <p className="text-sm font-medium text-amber-900">Your Coach</p>
                      <p className="text-sm text-amber-700">
                        {coaches[0].first_name} {coaches[0].last_name} (@{coaches[0].username})
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DashboardCard>
          )}
          </div>
        </div>

        {/* Weekly Goal Progress Card */}
        {myPlan && (
          <div className="mb-8">
            <DashboardCard title="Weekly Goal Progress">
              {(() => {
                // Calculate current week bookings
                const now = new Date()
                const startOfWeek = new Date(now)
                startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
                startOfWeek.setHours(0, 0, 0, 0)
                
                const endOfWeek = new Date(startOfWeek)
                endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
                endOfWeek.setHours(23, 59, 59, 999)

                const currentWeekBookings = bookings?.filter(booking => {
                  if (!booking.date) return false
                  const bookingDate = new Date(booking.date)
                  return bookingDate >= startOfWeek && 
                         bookingDate <= endOfWeek && 
                         booking.status === 'confirmed'
                }).length || 0

                const weeklyGoal = myPlan.sessions_per_week
                const progressPercentage = Math.min((currentWeekBookings / weeklyGoal) * 100, 100)
                const remaining = Math.max(weeklyGoal - currentWeekBookings, 0)

                return (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 rounded-full p-2">
                          <span className="text-2xl">🎯</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-blue-900">
                            This Week's Progress
                          </h3>
                          <p className="text-sm text-blue-600">
                            {currentWeekBookings} of {weeklyGoal} sessions completed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-900">
                          {currentWeekBookings}/{weeklyGoal}
                        </div>
                        <div className="text-sm text-blue-600">
                          {remaining > 0 ? `${remaining} remaining` : 'Goal achieved! 🎉'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-blue-200 rounded-full h-3 mb-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-700 font-medium">
                        {progressPercentage.toFixed(0)}% Complete
                      </span>
                      {remaining > 0 && (
                        <button
                          onClick={handleBookingClick}
                          className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 transition duration-200"
                        >
                          Book Sessions
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </DashboardCard>
          </div>
        )}

        {/* Subscription Section */}
        <div className="mb-8">
          {showSubscriptionPlans ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Choose Your Subscription Plan</h2>
                <button
                  onClick={() => setShowSubscriptionPlans(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SubscriptionPlans 
                onSubscriptionSuccess={() => {
                  setShowSubscriptionPlans(false)
                  // Refresh the page or update subscription status
                  window.location.reload()
                }}
              />
            </div>
          ) : (
            <SubscriptionStatus 
              onNeedSubscription={() => setShowSubscriptionPlans(true)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Bookings */}
          <div className="space-y-6">
            {bookingsLoading ? (
              <LoadingCard title="My Bookings" />
            ) : (
              <DashboardCard 
                title="My Bookings" 
                action={
                  <button
                    onClick={handleBookingClick}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Book Session
                  </button>
                }
              >
                {bookings && bookings.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {bookings
                      .sort((a, b) => {
                        // First sort by status priority (confirmed, pending, cancelled, completed)
                        const statusPriority = { 'confirmed': 1, 'pending': 2, 'cancelled': 3, 'completed': 4 };
                        const statusA = statusPriority[a.status as keyof typeof statusPriority] || 5;
                        const statusB = statusPriority[b.status as keyof typeof statusPriority] || 5;
                        
                        if (statusA !== statusB) {
                          return statusA - statusB;
                        }
                        
                        // Then sort by date (closest first for each status)
                        const dateA = new Date(a.date || 0);
                        const dateB = new Date(b.date || 0);
                        return dateA.getTime() - dateB.getTime();
                      })
                      .map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-700">
                              Session #{booking.id}
                            </p>
                            <StatusBadge 
                              status={booking.status} 
                              variant={
                                booking.status === 'confirmed' ? 'success' :
                                booking.status === 'pending' ? 'warning' :
                                booking.status === 'cancelled' ? 'error' :
                                booking.status === 'completed' ? 'info' : 'default'
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-900 font-medium">
                              {booking.date ? 
                                new Date(booking.date).toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                                : 'Date & time to be scheduled'
                              }
                            </p>
                            <p className="text-xs text-gray-500">
                              1 hour session
                            </p>
                          </div>
                          {booking.coach_notes && (
                            <p className="text-xs text-gray-500 mt-1">
                              Note: {booking.coach_notes}
                            </p>
                          )}
                          {booking.workout && (
                            <p className="text-xs text-blue-600 mt-1 font-medium">
                              🏋️ {booking.workout}
                            </p>
                          )}
                          {booking.status === 'pending' && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Cancel Booking
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-200">
                      <button
                        onClick={() => window.location.href = '/booking'}
                        className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        Book More Sessions
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No bookings yet"
                    description="Book your first session to start your fitness journey!"
                    actionLabel="Book Now"
                    onAction={handleBookingClick}
                  />
                )}
              </DashboardCard>
            )}
          </div>

          {/* Payment History */}
          <div className="space-y-6">
            {/* Payment History */}
            {paymentsLoading ? (
              <LoadingCard title="Payment History" />
            ) : (
              <DashboardCard title="Payment History">
                {payments && payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.slice(0, 4).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            ${payment.amount} {payment.currency}
                          </p>
                          <p className="text-sm text-gray-600">
                            {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : 'Not paid yet'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.duration_months} month{payment.duration_months !== 1 ? 's' : ''} • {payment.provider || 'Unknown'}
                          </p>
                          {payment.is_active && (
                            <p className="text-xs text-green-600 font-medium">Active</p>
                          )}
                        </div>
                        <StatusBadge 
                          status={payment.status}
                          variant={
                            payment.status === 'PAID' ? 'success' :
                            payment.status === 'REQUIRES_PAYMENT' ? 'warning' :
                            payment.status === 'INITIATED' ? 'info' :
                            payment.status === 'FAILED' ? 'error' :
                            payment.status === 'CANCELED' ? 'error' :
                            payment.status === 'EXPIRED' ? 'error' : 'default'
                          }
                        />
                      </div>
                    ))}
                    {payments.length > 4 && (
                      <p className="text-sm text-gray-500 text-center">
                        And {payments.length - 4} more payments...
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="No payments yet"
                    description="Your payment history will appear here after you make your first payment."
                  />
                )}
              </DashboardCard>
            )}

            {/* My Coach */}
            {coachesLoading ? (
              <LoadingCard title="My Coach" />
            ) : (
              <DashboardCard title="My Coach">
                {coaches && coaches.length > 0 ? (
                  <div className="space-y-3">
                    {coaches.slice(0, 1).map((coach) => (
                      <div key={coach.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {coach.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-lg">{coach.username}</p>
                          {coach.first_name && coach.last_name && (
                            <p className="text-sm text-gray-600">
                              {coach.first_name} {coach.last_name}
                            </p>
                          )}
                          {coach.rating && (
                            <p className="text-sm text-gray-600">
                              ⭐ {coach.rating}/5
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No assigned coach"
                    description="You don't have an assigned coach yet. Browse available coaches to get started."
                    actionLabel="Find a Coach"
                    onAction={() => window.location.href = '/coach-selection'}
                  />
                )}
              </DashboardCard>
            )}
          </div>
        </div>
      </main>

      {/* Plan Details Modal */}
      {showPlanDetails && myPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Workout Plan Details</h2>
                <button
                  onClick={() => setShowPlanDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Plan Overview */}
                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-100 rounded-full p-3">
                      <span className="text-3xl">💪</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-green-900">
                        {formatPlanType(myPlan.plan_type)}
                      </h3>
                      <p className="text-green-600">
                        {myPlan.sessions_per_week} sessions per week
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Plan Type:</span>
                      <span className="ml-2 font-medium text-gray-900">{myPlan.plan_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sessions/Week:</span>
                      <span className="ml-2 font-medium text-gray-900">{myPlan.sessions_per_week}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Assigned Date:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {new Date(myPlan.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Your Coach:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {myPlan.coach_name || myPlan.coach_username || 'Not assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plan Description */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-blue-900 mb-3">About Your Plan</h4>
                  <div className="text-blue-800 space-y-2">
                    {myPlan.plan_type === 'AB' && (
                      <p>Upper/Lower Body Split - A balanced approach focusing on upper body one day and lower body the next. Perfect for beginners and those with limited time.</p>
                    )}
                    {myPlan.plan_type === 'ABC' && (
                      <p>Push/Pull/Legs Split - A comprehensive 3-day routine that targets all major muscle groups efficiently. Great for intermediate fitness levels.</p>
                    )}
                    {myPlan.plan_type === 'PPL' && (
                      <p>Push/Pull/Legs Split - Similar to ABC but with more focus on movement patterns. Ideal for those who want to train more frequently.</p>
                    )}
                    {myPlan.plan_type === 'FIVE_DAY' && (
                      <p>Five Day Split - An advanced routine for serious fitness enthusiasts. Each day targets specific muscle groups for maximum development.</p>
                    )}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Next Steps</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">1</span>
                      <span className="text-gray-700">Book your training sessions</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">2</span>
                      <span className="text-gray-700">Follow your coach's workout guidance</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">3</span>
                      <span className="text-gray-700">Track your progress with your coach</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        setShowPlanDetails(false);
                        window.location.href = '/booking';
                      }}
                      className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Book Training Sessions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}