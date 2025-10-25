import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore'
import { 
  useMyClients, 
  useCoachBookings, 
  usePendingBookings,
  useApproveBooking,
  useRejectBooking
} from '@/hooks'
import { 
  usePendingPlanRequests, 
  useUpdatePlanRequest,
  formatPlanType,
  getRequestStatusColor 
} from '@/hooks/useSchedule'
import { apiClient } from '@/lib/api'
import type { ClientProfile } from '@/hooks/useUsers'
import { 
  DashboardCard, 
  StatCard, 
  LoadingCard, 
  EmptyState, 
  StatusBadge 
} from '@/components/ui/DashboardComponents'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Plan type to workout days mapping (same as in BookingPage)
const PLAN_WORKOUT_DAYS = {
  'AB': [
    { key: 'day_a', label: 'Day A - Upper Body', muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'] },
    { key: 'day_b', label: 'Day B - Lower Body', muscles: ['Legs', 'Calves'] }
  ],
  'ABC': [
    { key: 'day_a', label: 'Day A - Push', muscles: ['Chest', 'Shoulders', 'Triceps'] },
    { key: 'day_b', label: 'Day B - Pull', muscles: ['Back', 'Biceps'] },
    { key: 'day_c', label: 'Day C - Legs', muscles: ['Legs', 'Calves'] }
  ],
  'PPL': [
    { key: 'day_a', label: 'Push Day', muscles: ['Chest', 'Shoulders', 'Triceps'] },
    { key: 'day_b', label: 'Pull Day', muscles: ['Back', 'Biceps'] },
    { key: 'day_c', label: 'Legs Day', muscles: ['Legs', 'Calves'] }
  ],
  '5DAY': [
    { key: 'day_a', label: 'Day A - Chest', muscles: ['Chest', 'Triceps'] },
    { key: 'day_b', label: 'Day B - Back', muscles: ['Back', 'Biceps'] },
    { key: 'day_c', label: 'Day C - Shoulders', muscles: ['Shoulders'] },
    { key: 'day_d', label: 'Day D - Legs', muscles: ['Legs', 'Calves'] },
    { key: 'day_e', label: 'Day E - Arms', muscles: ['Biceps', 'Triceps'] }
  ]
};

export default function CoachDashboard() {
  const { user, logout } = useAuthStore()
  
  // Profile completion check (same as client dashboard)
  const isProfileIncomplete = () => {
    if (!user) return false;
    return !user.first_name || !user.last_name || !user.phone;
  };
  
  // Modal states
  const [showPlanApproval, setShowPlanApproval] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [selectedPlanType, setSelectedPlanType] = useState<string>('ABC')
  const [approvalMessage, setApprovalMessage] = useState('')
  
  // Booking approval states
  const [showBookingApproval, setShowBookingApproval] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [bookingApprovalMessage, setBookingApprovalMessage] = useState('')
  const [currentEditingBooking, setCurrentEditingBooking] = useState<number | null>(null)
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')
  const queryClient = useQueryClient()
  
  // Session filtering states
  const [sessionClientFilter, setSessionClientFilter] = useState<string>('')
  const [sessionDateFilter, setSessionDateFilter] = useState<string>('')
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('')
  
  // Fetch coach data using our hooks
  const { data: myClients, isLoading: clientsLoading } = useMyClients()
  const { data: bookings, isLoading: bookingsLoading } = useCoachBookings()
  const { data: pendingBookings, isLoading: pendingLoading } = usePendingBookings()
  const { data: pendingPlanRequests, isLoading: planRequestsLoading } = usePendingPlanRequests()

  // Mutations
  const approveBookingMutation = useApproveBooking()
  const rejectBookingMutation = useRejectBooking()
  const updatePlanRequestMutation = useUpdatePlanRequest()

  const handleLogout = () => {
    logout()
  }

  const handleApproveBooking = (booking: any) => {
    setSelectedBooking(booking)
    setSelectedWorkoutDay('') // Reset workout day selection
    setBookingApprovalMessage('') // Reset message
    setShowBookingApproval(true)
  }
  
  const handleConfirmBookingApproval = async () => {
    if (!selectedBooking) return
    
    // If coach needs to decide workout day, update it first
    let finalWorkoutDay = selectedBooking.workout;
    if (selectedBooking.workout === 'Coach will decide' && selectedWorkoutDay) {
      // Find the selected day from either the plan-specific options or fallback options
      let selectedDay = null;
      
      if (selectedBooking.plan && PLAN_WORKOUT_DAYS[selectedBooking.plan as keyof typeof PLAN_WORKOUT_DAYS]) {
        selectedDay = PLAN_WORKOUT_DAYS[selectedBooking.plan as keyof typeof PLAN_WORKOUT_DAYS].find(day => day.key === selectedWorkoutDay);
      } else {
        // Fallback options
        const fallbackOptions = [
          { key: 'day_a', label: 'Day A - Upper Body', muscles: ['Chest', 'Back', 'Shoulders', 'Arms'] },
          { key: 'day_b', label: 'Day B - Lower Body', muscles: ['Legs', 'Calves'] },
          { key: 'day_c', label: 'Day C - Full Body', muscles: ['All muscle groups'] }
        ];
        selectedDay = fallbackOptions.find(day => day.key === selectedWorkoutDay);
      }
      
      if (selectedDay) {
        finalWorkoutDay = `Coach decided: ${selectedDay.label}`;
        
        // Update the booking workout first
        try {
          const response = await apiClient.put(`/bookings/${selectedBooking.id}/workout`, { 
            workout_day: finalWorkoutDay 
          });
          console.log('Workout day updated successfully:', finalWorkoutDay);
          console.log('Response:', response);
          
          // Invalidate queries to refresh the booking data immediately
          await queryClient.removeQueries({ queryKey: ['bookings'] });
          await queryClient.removeQueries({ queryKey: ['bookings', 'my-bookings'] });
          await queryClient.removeQueries({ queryKey: ['coach-bookings'] });
          
          // Force immediate refetch
          await queryClient.prefetchQuery({ 
            queryKey: ['bookings', 'my-bookings'],
            queryFn: () => apiClient.get('/bookings/my-bookings')
          });
          
          // Add a small delay to ensure cache is cleared
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error('Failed to update workout day:', error);
          alert('Failed to update workout day. Please try again.');
          return;
        }
      }
    }
    
    console.log('Approving booking:', selectedBooking.id, 'with message:', bookingApprovalMessage)
    approveBookingMutation.mutate({ 
      bookingId: selectedBooking.id, 
      coachNotes: bookingApprovalMessage || undefined 
    }, {
      onSuccess: async () => {
        console.log('Booking approved successfully')
        setShowBookingApproval(false)
        setSelectedBooking(null)
        setBookingApprovalMessage('')
        setSelectedWorkoutDay('')
        
        // Invalidate all booking-related queries to ensure fresh data
        await queryClient.removeQueries({ queryKey: ['bookings'] })
        await queryClient.removeQueries({ queryKey: ['bookings', 'my-bookings'] })
        await queryClient.removeQueries({ queryKey: ['coach-bookings'] })
        
        // Force immediate refetch of client bookings data
        await queryClient.prefetchQuery({ 
          queryKey: ['bookings', 'my-bookings'],
          queryFn: () => apiClient.get('/bookings/my-bookings')
        })
      },
      onError: (error) => {
        console.error('Error approving booking:', error)
      }
    })
  }

  const handleRejectBooking = (bookingId: number) => {
    console.log('Rejecting booking:', bookingId)
    rejectBookingMutation.mutate(bookingId, {
      onSuccess: () => {
        console.log('Booking rejected successfully')
      },
      onError: (error) => {
        console.error('Error rejecting booking:', error)
      }
    })
  }

  const handleApprovePlanRequest = async (request: any) => {
    setSelectedRequest(request)
    setSelectedPlanType('ABC') // Default selection
    setApprovalMessage(`Plan approved! A ${selectedPlanType} plan has been created for you. We can customize it during our sessions.`)
    setShowPlanApproval(true)
  }

  const handleConfirmApproval = async () => {
    if (!selectedRequest) return
    
    try {
      await updatePlanRequestMutation.mutateAsync({
        requestId: selectedRequest.id,
        data: {
          status: 'APPROVED',
          response_message: approvalMessage,
          plan_type: selectedPlanType
        }
      })
      setShowPlanApproval(false)
      setSelectedRequest(null)
      alert(`Plan request approved! A ${selectedPlanType} plan has been created for the client.`)
    } catch (error: any) {
      console.error('Error approving plan request:', error)
      alert(error.response?.data?.detail || 'Failed to approve plan request. Please try again.')
    }
  }

  const handleRejectPlanRequest = async (requestId: number) => {
    const reason = prompt('Please provide a reason for rejection (optional):')
    
    try {
      await updatePlanRequestMutation.mutateAsync({
        requestId,
        data: {
          status: 'REJECTED',
          response_message: reason || 'Plan request was rejected. Please contact your coach for more information.'
        }
      })
      alert('Plan request rejected.')
    } catch (error: any) {
      console.error('Error rejecting plan request:', error)
      alert(error.response?.data?.detail || 'Failed to reject plan request. Please try again.')
    }
  }

  const handleViewClientProfile = async (clientId: number, clientUsername: string) => {
    try {
      console.log('Fetching client profile for:', clientId)
      const profile = await apiClient.get<ClientProfile>(`/users/client-profile/${clientId}`)
      
      let membershipInfo = 'No membership information available'
      if (profile.membership) {
        const memberSince = profile.membership.member_since 
          ? new Date(profile.membership.member_since).toLocaleDateString('en-US', { 
              day: 'numeric', month: 'short', year: 'numeric' 
            })
          : 'N/A'
        
        const activeUntil = profile.membership.active_until 
          ? new Date(profile.membership.active_until).toLocaleDateString('en-US', { 
              day: 'numeric', month: 'short', year: 'numeric' 
            })
          : 'N/A'
        
        membershipInfo = `Member since: ${memberSince}\nActive until: ${activeUntil}\nPlan: ${profile.membership.plan_name || 'N/A'}\nStatus: ${profile.membership.status || 'N/A'}`
      }
      
      const profileDetails = `Client Profile:\n\nName: ${profile.first_name || 'N/A'} ${profile.last_name || 'N/A'}\nUsername: ${profile.username}\nEmail: ${profile.email}\nPhone: ${profile.phone || 'N/A'}\n\n${membershipInfo}`
      
      alert(profileDetails)
    } catch (error) {
      console.error('Error fetching client profile:', error)
      alert(`Error loading profile for ${clientUsername}. Please try again.`)
    }
  }

  // Calculate stats
  const totalClients = myClients?.length || 0
  const pendingCount = pendingBookings?.length || 0
  const planRequestsCount = pendingPlanRequests?.length || 0

  const upcomingBookings = bookings?.filter(b => 
    b.date && new Date(b.date) > new Date() && (b.status === 'confirmed')
  ).length || 0

  // Filter bookings for Recent Sessions
  const filteredBookings = bookings?.filter(booking => {
    // Client filter
    if (sessionClientFilter) {
      const clientName = booking.client ? 
        `${booking.client.first_name || booking.client.username} ${booking.client.last_name || ''}`.trim().toLowerCase() 
        : `client ${booking.client_id}`.toLowerCase()
      if (!clientName.includes(sessionClientFilter.toLowerCase())) return false
    }
    
    // Date filter (if specified, show only bookings from that date)
    if (sessionDateFilter) {
      const bookingDate = booking.date ? new Date(booking.date).toDateString() : ''
      const filterDate = new Date(sessionDateFilter).toDateString()
      if (bookingDate !== filterDate) return false
    }
    
    // Status filter
    if (sessionStatusFilter && booking.status !== sessionStatusFilter) return false
    
    return true
  }) || []

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
                  Private Coach - Coach Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={`${user.username}'s avatar`}
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-600">
                  Welcome, Coach {user?.username}
                </span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {user?.role}
              </span>
              <div className="relative">
                <Link
                  to="/profile"
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition duration-200"
                  title={isProfileIncomplete() ? "Complete your profile - missing information!" : "View your profile"}
                >
                  Profile
                </Link>
                {isProfileIncomplete() && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Active Clients"
            value={totalClients}
            subtitle="Currently training"
            icon={<span className="text-2xl">👥</span>}
          />
          <StatCard
            title="Plan Requests"
            value={planRequestsCount}
            subtitle="Awaiting review"
            icon={<span className="text-2xl">📋</span>}
          />
          <StatCard
            title="Pending Bookings"
            value={pendingCount}
            subtitle="Awaiting approval"
            icon={<span className="text-2xl">⏳</span>}
          />
          <StatCard
            title="Upcoming Sessions"
            value={upcomingBookings}
            subtitle="This week"
            icon={<span className="text-2xl">📅</span>}
          />

        </div>

        {/* Plan Requests Section */}
        {planRequestsLoading ? (
          <div className="mb-8">
            <LoadingCard title="Plan Requests" />
          </div>
        ) : planRequestsCount > 0 ? (
          <div className="mb-8">
            <DashboardCard title="Plan Requests - Action Required">
              <div className="max-h-[400px] overflow-y-auto">
                <div className="space-y-4">
                  {pendingPlanRequests?.map((request) => (
                  <div key={request.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-amber-100 rounded-full p-2">
                          <span className="text-xl">📋</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-amber-900">
                            Plan Request #{request.id}
                          </h4>
                          <p className="text-sm text-amber-600">
                            Client ID: {request.client_id}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRequestStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    
                    {request.message && (
                      <div className="bg-white rounded-md p-3 mb-3 border border-amber-200">
                        <p className="text-sm font-medium text-amber-900 mb-1">Client Message:</p>
                        <p className="text-sm text-amber-700">{request.message}</p>
                      </div>
                    )}

                    <div className="text-xs text-amber-600 mb-3">
                      Requested: {new Date(request.created_at).toLocaleDateString('en-US', { 
                        day: 'numeric', month: 'short', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApprovePlanRequest(request)}
                        disabled={updatePlanRequestMutation.isPending}
                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve & Create Plan
                      </button>
                      <button
                        onClick={() => handleRejectPlanRequest(request.id)}
                        disabled={updatePlanRequestMutation.isPending}
                        className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </DashboardCard>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Bookings - Most Important */}
          <div className="lg:col-span-2 space-y-6">
            {pendingLoading ? (
              <LoadingCard title="Pending Bookings" />
            ) : (
              <DashboardCard title="Pending Bookings - Action Required">
                <div className="max-h-[500px] overflow-y-auto">
                  {pendingBookings && pendingBookings.length > 0 ? (
                  <div className="space-y-4">
                    {pendingBookings.map((booking) => (
                      <div key={booking.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              Session Request #{booking.id}
                            </p>
                            <p className="text-sm text-gray-600">
                              {booking.client ? 
                                `${booking.client.first_name || booking.client.username} ${booking.client.last_name || ''}`.trim() 
                                : `Client ID: ${booking.client_id}`
                              }
                            </p>
                            {booking.client?.email && (
                              <p className="text-xs text-gray-500">
                                {booking.client.email}
                              </p>
                            )}
                            <p className="text-sm text-gray-600">
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
                            <p className="text-sm text-gray-500">
                              1 hour session
                            </p>
                          </div>
                          <StatusBadge status={booking.status} variant="warning" />
                        </div>
                        {booking.coach_notes && (
                          <p className="text-sm text-gray-600 mb-3">
                            <strong>Notes:</strong> {booking.coach_notes}
                          </p>
                        )}
                        {booking.workout && (
                          <p className="text-sm text-blue-600 mb-3">
                            <strong>Workout:</strong> {booking.workout}
                          </p>
                        )}
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleApproveBooking(booking)}
                            disabled={approveBookingMutation.isPending}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectBooking(booking.id)}
                            disabled={rejectBookingMutation.isPending}
                            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No pending bookings"
                    description="All booking requests have been processed."
                  />
                )}
                </div>
              </DashboardCard>
            )}

            {/* My Clients */}
            {clientsLoading ? (
              <LoadingCard title="My Clients" />
            ) : (
              <DashboardCard 
                title="My Clients"
              >
                <div className="max-h-[500px] overflow-y-auto">
                  {myClients && myClients.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myClients.map((client) => (
                      <div key={client.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {client.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{client.username}</p>
                            <p className="text-sm text-gray-600">{client.email}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button 
                            onClick={() => handleViewClientProfile(client.id, client.username)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No clients yet"
                    description="Start building your client base by accepting booking requests."
                    actionLabel="Find Potential Clients"
                    onAction={() => console.log('Navigate to client search')}
                  />
                )}
                </div>
              </DashboardCard>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Recent Bookings */}
            {bookingsLoading ? (
              <LoadingCard title="Recent Sessions" />
            ) : (
              <DashboardCard title="Recent Sessions">
                <div className="max-h-[500px] overflow-y-auto">
                  {/* Filter Controls */}
                <div className="mb-4 space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                      <input
                        type="text"
                        placeholder="Search client..."
                        value={sessionClientFilter}
                        onChange={(e) => setSessionClientFilter(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={sessionDateFilter}
                        onChange={(e) => setSessionDateFilter(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={sessionStatusFilter}
                        onChange={(e) => setSessionStatusFilter(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                  {(sessionClientFilter || sessionDateFilter || sessionStatusFilter) && (
                    <button
                      onClick={() => {
                        setSessionClientFilter('')
                        setSessionDateFilter('')
                        setSessionStatusFilter('')
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {filteredBookings && filteredBookings.length > 0 ? (
                  <div className="space-y-3">
                    {filteredBookings.slice(0, 10).map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {booking.client ? 
                              `${booking.client.first_name || booking.client.username} ${booking.client.last_name || ''}`.trim() 
                              : `Client ${booking.client_id}`
                            }
                          </p>
                          <p className="text-xs text-gray-600">
                            {booking.date ? new Date(booking.date).toLocaleDateString() : 'TBD'}
                          </p>
                        </div>
                        <StatusBadge 
                          status={booking.status}
                          variant={
                            booking.status === 'confirmed' ? 'success' :
                            booking.status === 'completed' ? 'info' :
                            booking.status === 'cancelled' ? 'error' :
                            booking.status === 'pending' ? 'warning' : 'default'
                          }
                        />
                      </div>
                    ))}
                    {filteredBookings.length > 10 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Showing 10 of {filteredBookings.length} sessions
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title={bookings && bookings.length > 0 ? "No matching sessions" : "No sessions yet"}
                    description={bookings && bookings.length > 0 ? "Try adjusting your filters." : "Your session history will appear here."}
                  />
                )}
                </div>
              </DashboardCard>
            )}


          </div>
        </div>
      </main>

      {/* Plan Approval Modal */}
      {showPlanApproval && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Approve Plan Request</h2>
                <button
                  onClick={() => setShowPlanApproval(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Client Info */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900">Client Request</h3>
                  <p className="text-blue-800 text-sm mt-1">
                    Client ID: {selectedRequest.client_id}
                  </p>
                  {selectedRequest.message && (
                    <p className="text-blue-700 text-sm mt-2 italic">
                      "{selectedRequest.message}"
                    </p>
                  )}
                </div>

                {/* Plan Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Plan Type
                  </label>
                  <select
                    value={selectedPlanType}
                    onChange={(e) => setSelectedPlanType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="AB">AB - Upper/Lower Split (2x/week)</option>
                    <option value="ABC">ABC - Push/Pull/Legs (3x/week)</option>
                    <option value="PPL">PPL - Push/Pull/Legs (3x/week)</option>
                    <option value="FIVE_DAY">Five Day Split (5x/week)</option>
                  </select>
                </div>

                {/* Response Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Response Message
                  </label>
                  <textarea
                    value={approvalMessage}
                    onChange={(e) => setApprovalMessage(e.target.value)}
                    placeholder="Add a personal message for the client..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowPlanApproval(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmApproval}
                    disabled={updatePlanRequestMutation.isPending}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {updatePlanRequestMutation.isPending ? 'Approving...' : 'Approve & Create Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Approval Modal */}
      {showBookingApproval && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Approve Booking Session
              </h3>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">Booking Details:</h4>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Client:</strong> {selectedBooking.client?.username || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Date:</strong> {selectedBooking.date ? 
                    new Date(selectedBooking.date).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) : 'TBD'
                  }
                </p>
                {selectedBooking.workout && (
                  <p className="text-sm text-gray-600">
                    <strong>Workout Focus:</strong> {selectedBooking.workout}
                  </p>
                )}
                {/* Debug info */}
                <p className="text-xs text-red-600 mt-1">
                  DEBUG - Plan: {selectedBooking.plan || 'No Plan'} | 
                  Workout: {selectedBooking.workout} | 
                  Should show selection: {(selectedBooking.workout === 'Coach will decide' && selectedBooking.plan) ? 'YES' : 'NO'}
                </p>
              </div>

              {/* Workout Day Selection - Only show if coach needs to decide */}
              {selectedBooking.workout === 'Coach will decide' ? (
                <div className="mb-4 border-2 border-blue-300 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Choose Workout Focus for Client (Plan: {selectedBooking.plan || 'Unknown'}):
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedBooking.plan && PLAN_WORKOUT_DAYS[selectedBooking.plan as keyof typeof PLAN_WORKOUT_DAYS] ? 
                      PLAN_WORKOUT_DAYS[selectedBooking.plan as keyof typeof PLAN_WORKOUT_DAYS].map((day) => (
                        <button
                          key={day.key}
                          onClick={() => setSelectedWorkoutDay(day.key)}
                          className={`w-full text-left p-3 border rounded-lg transition-colors ${
                            selectedWorkoutDay === day.key
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{day.label}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Focus: {day.muscles.join(', ')}
                          </div>
                        </button>
                      )) : 
                      // Fallback - show generic options if plan not recognized
                      [
                        { key: 'day_a', label: 'Day A - Upper Body', muscles: ['Chest', 'Back', 'Shoulders', 'Arms'] },
                        { key: 'day_b', label: 'Day B - Lower Body', muscles: ['Legs', 'Calves'] },
                        { key: 'day_c', label: 'Day C - Full Body', muscles: ['All muscle groups'] }
                      ].map((day) => (
                        <button
                          key={day.key}
                          onClick={() => setSelectedWorkoutDay(day.key)}
                          className={`w-full text-left p-3 border rounded-lg transition-colors ${
                            selectedWorkoutDay === day.key
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{day.label}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Focus: {day.muscles.join(', ')}
                          </div>
                        </button>
                      ))
                    }
                  </div>
                  {!selectedWorkoutDay && (
                    <p className="text-xs text-red-600 mt-2">
                      Please select a workout focus before approving
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mb-4">
                <label htmlFor="coachMessage" className="block text-sm font-medium text-gray-700 mb-2">
                  Message for Client (Optional)
                </label>
                <textarea
                  id="coachMessage"
                  rows={3}
                  value={bookingApprovalMessage}
                  onChange={(e) => setBookingApprovalMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave a message about the workout plan, preparation tips, or any other notes..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBookingApproval(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBookingApproval}
                  disabled={
                    approveBookingMutation.isPending || 
                    (selectedBooking.workout === 'Coach will decide' && !selectedWorkoutDay)
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {approveBookingMutation.isPending ? 'Approving...' : 'Approve Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}