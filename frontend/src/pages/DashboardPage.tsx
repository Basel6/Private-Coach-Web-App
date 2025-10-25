import { useAuthStore } from '@/store/authStore'
import ClientDashboard from './ClientDashboard'
import CoachDashboard from './CoachDashboard'
import AccountantDashboard from './AccountantDashboard'

export default function DashboardPage() {
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
  }

  // Route to appropriate dashboard based on user role
  if (user?.role === 'CLIENT') {
    return <ClientDashboard />
  }
  
  if (user?.role === 'COACH') {
    return <CoachDashboard />
  }
  
  if (user?.role === 'ACCOUNTANT') {
    return <AccountantDashboard />
  }

  // Fallback for unknown roles or loading state
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Private Coach Logo" className="h-10 w-10 rounded-xl object-contain" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Private Coach Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.username}
              </span>
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
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {user?.role === 'CLIENT' ? 'Client Dashboard' : 'Coach Dashboard'}
              </h2>
              
              {user?.role === 'CLIENT' ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900">Welcome to Private Coach!</h3>
                    <p className="text-blue-700 mt-1">
                      Find the perfect coach and start your fitness journey.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">Book Sessions</h4>
                      <p className="text-gray-600 text-sm mt-1">Find and book sessions with coaches</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">My Workouts</h4>
                      <p className="text-gray-600 text-sm mt-1">View assigned workouts and track progress</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-900">Coach Dashboard</h3>
                    <p className="text-green-700 mt-1">
                      Manage your clients and grow your coaching business.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">My Clients</h4>
                      <p className="text-gray-600 text-sm mt-1">Manage your client relationships</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">Schedule</h4>
                      <p className="text-gray-600 text-sm mt-1">View and manage your sessions</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}