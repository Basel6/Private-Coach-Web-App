import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCoaches, useSelectCoach } from '@/hooks/useUsers';
import { User, ArrowLeft, Clock, CheckCircle } from 'lucide-react';

const CoachSelectionPage: React.FC = () => {
  const { user } = useAuthStore();
  const { data: coaches, isLoading } = useCoaches();
  const selectCoach = useSelectCoach();

  const handleSelectCoach = async (coachId: number, coachName: string) => {
    try {
      await selectCoach.mutateAsync(coachId);
      alert(`Successfully selected ${coachName} as your coach! You can now book sessions.`);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Failed to select coach:', error);
      alert(error.response?.data?.detail || 'Failed to select coach. Please try again.');
    }
  };

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
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 hover:text-gray-900 flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Private Coach Logo" className="h-8 w-8 rounded-xl object-contain" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Select Your Coach
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.username}
              </span>
              <Link
                to="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Personal Trainer</h2>
          <p className="text-gray-600">
            Select a coach that matches your fitness goals and schedule preferences. You can change your coach later if needed.
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
                <div key={coach.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {coachDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{coachDisplayName}</h3>
                        <p className="text-sm text-gray-600">Professional Trainer</p>
                        {coach.phone && (
                          <p className="text-sm text-gray-600">{coach.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Shift Information */}
                    <div className="mb-4">
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>Available for training</span>
                      </div>
                      <button 
                        onClick={() => handleSelectCoach(coach.id, coachDisplayName)}
                        disabled={selectCoach.isPending}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        {selectCoach.isPending ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            <span>Select Coach</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Coaches Available</h3>
            <p className="text-gray-600 mb-6">
              We're currently updating our coach roster. Please check back later.
            </p>
            <Link
              to="/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachSelectionPage;