import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';
import { User, Clock } from 'lucide-react';

// Local interface for public coach data
interface PublicCoach {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  shift_start_hour?: number;
  shift_end_hour?: number;
}

const CoachesPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  
  // Profile completion check (same as client dashboard)
  const isProfileIncomplete = () => {
    if (!user) return false;
    return !user.first_name || !user.last_name || !user.phone;
  };
  
  // Create a query to fetch real coaches from API
  const { data: coaches, isLoading } = useQuery({
    queryKey: ['public-coaches'],
    queryFn: async (): Promise<PublicCoach[]> => {
      try {
        // Try to fetch real coaches from the API
        const response = await apiClient.get<PublicCoach[]>('/users/coaches');
        return response;
      } catch (error) {
        // If API fails (e.g., requires auth), return demo data as fallback
        console.warn('Failed to load coaches from API, using demo data:', error);
        return [
          {
            id: 1,
            username: 'johnsmith',
            first_name: 'John',
            last_name: 'Smith',
            shift_start_hour: 8,
            shift_end_hour: 12,
          },
          {
            id: 2,
            username: 'janecooper',
            first_name: 'Jane',
            last_name: 'Cooper',
            shift_start_hour: 14,
            shift_end_hour: 22,
          },
          {
            id: 3,
            username: 'mikejohnson',
            first_name: 'Mike',
            last_name: 'Johnson',
            shift_start_hour: 8,
            shift_end_hour: 12,
          },
          {
            id: 4,
            username: 'democoach',
            first_name: 'Demo',
            last_name: 'Coach',
            shift_start_hour: 8,
            shift_end_hour: 12,
          },
          {
            id: 5,
            username: 'coach_sarah',
            first_name: 'Sarah',
            last_name: 'Wilson',
            shift_start_hour: 14,
            shift_end_hour: 22,
          },
          {
            id: 6,
            username: 'musta',
            first_name: 'Musta',
            last_name: 'Ali',
            shift_start_hour: 8,
            shift_end_hour: 12,
          },
        ];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const formatShiftTime = (hour: number) => {
    if (hour <= 12) {
      return hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
    } else {
      return `${hour - 12}:00 PM`;
    }
  };

  const getShiftType = (startHour: number, endHour: number) => {
    if (startHour === 8 && endHour === 12) {
      return { type: 'Morning Shift', color: 'bg-yellow-100 text-yellow-800' };
    } else if (startHour === 14 && endHour === 22) {
      return { type: 'Evening Shift', color: 'bg-blue-100 text-blue-800' };
    } else {
      return { type: 'Custom Shift', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading available coaches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Private Coach Logo" className="h-8 w-8 rounded-xl object-contain" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Our Coaches
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                // Logged in user navigation
                <>
                  <Link
                    to="/"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Home
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <div className="relative">
                    <Link
                      to="/profile"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      title={isProfileIncomplete() ? "Complete your profile - missing information!" : "View your profile"}
                    >
                      Profile
                    </Link>
                    {isProfileIncomplete() && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                </>
              ) : (
                // Non-logged in user navigation
                <>
                  <Link
                    to="/"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Back to Home
                  </Link>
                  <Link
                    to="/login"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Meet Our Professional Trainers</h2>
          <p className="text-gray-600">
            Our certified coaches are here to help you achieve your fitness goals. Each coach brings unique expertise and experience.
          </p>
        </div>

        {/* Opening Hours Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Our Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-blue-800">Morning Sessions</div>
              <div className="text-blue-600">8:00 AM - 12:00 PM</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-600 italic">Lunch Break</div>
              <div className="text-gray-500 italic">12:00 PM - 2:00 PM</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-800">Afternoon Sessions</div>
              <div className="text-blue-600">2:00 PM - 10:00 PM</div>
            </div>
          </div>
          <div className="text-center mt-3 text-xs text-blue-700">
            Available 7 days a week
          </div>
        </div>

        {coaches && coaches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => {
              const shiftInfo = getShiftType(coach.shift_start_hour || 0, coach.shift_end_hour || 0);
              const coachDisplayName = coach.first_name && coach.last_name 
                ? `${coach.first_name} ${coach.last_name}` 
                : coach.username;

              return (
                <div key={coach.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  {/* Coach Avatar */}
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full mx-auto bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {coachDisplayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Coach Info */}
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Coach {coachDisplayName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Professional Trainer
                    </p>
                  </div>

                  {/* Working Hours */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600 font-medium">Working Hours</span>
                    </div>
                    {coach.shift_start_hour && coach.shift_end_hour ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            {formatShiftTime(coach.shift_start_hour)} - {formatShiftTime(coach.shift_end_hour)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${shiftInfo.color}`}>
                            {shiftInfo.type}
                          </span>
                        </div>
                        {(coach.shift_end_hour === 12 || coach.shift_start_hour === 14) && (
                          <p className="text-xs text-gray-500">* Lunch break: 12:00 PM - 2:00 PM</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Morning:</span>
                          <span>8:00 AM - 12:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Afternoon:</span>
                          <span>2:00 PM - 10:00 PM</span>
                        </div>
                        <div className="text-center mt-2 text-green-600 font-medium">
                          Daily • 7 days/week
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contact/Book CTA */}
                  <div className="text-center">
                    {isAuthenticated ? (
                      <Link
                        to="/booking"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Book Sessions
                      </Link>
                    ) : (
                      <Link
                        to="/register"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Book Sessions
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Coaches Available</h3>
            <p className="text-gray-600">
              We're currently building our team of professional trainers. Check back soon!
            </p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 text-center bg-white rounded-lg border border-gray-200 p-8">
          {isAuthenticated ? (
            // Logged in user CTA
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Continue Your Fitness Journey!</h3>
              <p className="text-gray-600 mb-4">
                Book sessions with our professional coaches and track your progress through your dashboard.
              </p>
              <div className="space-x-4">
                <Link
                  to="/booking"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
                >
                  Book a Session
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-block border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-md font-medium"
                >
                  Go to Dashboard
                </Link>
              </div>
            </>
          ) : (
            // Non-logged in user CTA
            <>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Start Your Fitness Journey?</h3>
              <p className="text-gray-600 mb-4">
                Join our platform to book sessions with our professional coaches and track your progress.
              </p>
              <div className="space-x-4">
                <Link
                  to="/register"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
                >
                  Join as a Client
                </Link>
                <Link
                  to="/login"
                  className="inline-block border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-md font-medium"
                >
                  Already have an account?
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="Private Coach Logo" className="h-4 w-4 rounded object-contain" />
          © {new Date().getFullYear()} Private Coach — All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default CoachesPage;