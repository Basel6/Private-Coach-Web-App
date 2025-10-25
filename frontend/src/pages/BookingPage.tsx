import React, { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useMyCoaches } from '@/hooks/useUsers';
import { 
  useMyPlan, 
  useMyPlanRequests, 
  useCreatePlanRequest,
  useMyPreference,
  useCreateOrUpdatePreference 
} from '@/hooks/useSchedule';
import { 
  useAvailableSlots, 
  useGenerateAISuggestions, 
  useBookSelected,
  useCreateBooking,
  useReSuggestIndividual,
  useReSuggestAll,
  useUpdateBookingWorkout,
  type AISuggestion
} from '@/hooks/useBookings';
import { useDbWorkoutTemplates } from '@/hooks/useWorkouts';
import { Calendar, User, Zap, RefreshCw, CheckCircle2, AlertCircle, MessageSquare, Dumbbell } from 'lucide-react';

// Plan type to workout days mapping
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

interface BookingPageProps {}

interface TimeSlot {
  hour: number;
  available: boolean;
  slotId?: number;
  coachId?: number;
}

interface CalendarDay {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  timeSlots: TimeSlot[];
}



const BookingPage: React.FC<BookingPageProps> = () => {
  const { user } = useAuthStore();
  const { data: coaches, isLoading: coachesLoading } = useMyCoaches();
  const { data: myPlan, isLoading: planLoading } = useMyPlan();
  const { data: myPlanRequests } = useMyPlanRequests();
  const { data: myPreference } = useMyPreference();
  const createPlanRequest = useCreatePlanRequest();
  const updatePreference = useCreateOrUpdatePreference();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookingMode, setBookingMode] = useState<'manual' | 'ai'>('manual');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]); // slot_ids
  const [aiMessage, setAiMessage] = useState<string>(''); // Store AI response message
  const [showPlanRequest, setShowPlanRequest] = useState<boolean>(false);
  const [planRequestMessage, setPlanRequestMessage] = useState<string>('');
  
  // Workout suggestions state
  const [showWorkoutSuggestions, setShowWorkoutSuggestions] = useState<boolean>(false);
  const [lastBookingId, setLastBookingId] = useState<number | null>(null);
  
  // Workout day selection state
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<string>('');
  const [showWorkoutDaySelection, setShowWorkoutDaySelection] = useState<boolean>(false);
  
  // Preference setting states
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [prefStartHour, setPrefStartHour] = useState<number>(14); // Default to coach's start hour
  const [prefEndHour, setPrefEndHour] = useState<number>(20);   // Default end hour
  const [isFlexible, setIsFlexible] = useState<boolean>(true);
  const [numSessions, setNumSessions] = useState<number>(3);
  
  // Initialize preference state with existing data or coach's working hours
  useEffect(() => {
    if (myPreference) {
      setPrefStartHour(myPreference.preferred_start_hour || 14)
      setPrefEndHour(myPreference.preferred_end_hour || 20)
      setIsFlexible(myPreference.is_flexible)
    } else if (coaches && coaches[0]) {
      // Set defaults based on coach's working hours when no preferences exist
      setPrefStartHour(coaches[0].shift_start_hour || 14)
      setPrefEndHour(Math.min(coaches[0].shift_end_hour || 22, 20)) // Cap at reasonable hour
    }
  }, [myPreference, coaches])

  // Debug logging
  console.log('BookingPage Debug:', {
    user: user ? { id: user.id, username: user.username, role: user.role } : null,
    coaches: coaches,
    myPlan: myPlan,
    planLoading,
    coachesRaw: coaches ? JSON.stringify(coaches, null, 2) : null,
    firstCoach: coaches?.[0],
    firstCoachId: coaches?.[0]?.id,
    coachesLoading,
    selectedSlots: selectedSlots.length,
    selectedDate: selectedDate.toISOString().split('T')[0]
  });
  const [sessionToken, setSessionToken] = useState<string>('');

  // API hooks
  const generateSuggestions = useGenerateAISuggestions();
  const bookSelected = useBookSelected();
  const createBooking = useCreateBooking();
  const reSuggestIndividual = useReSuggestIndividual();
  const reSuggestAll = useReSuggestAll();
  const updateBookingWorkout = useUpdateBookingWorkout();
  
  // Use the general workout templates instead of booking-specific ones
  const selectedDayInfo = myPlan && selectedWorkoutDay ? 
    PLAN_WORKOUT_DAYS[myPlan.plan_type as keyof typeof PLAN_WORKOUT_DAYS]?.find(day => day.key === selectedWorkoutDay) : null;
  
  // Fetch workout templates for selected muscles
  const { data: workoutSuggestions, isLoading: workoutSuggestionsLoading } = useDbWorkoutTemplates(
    undefined // Don't filter by muscle group initially, we'll filter client-side
  );

  // Get available slots for the selected date range  
  const dateFrom = selectedDate.toISOString().split('T')[0];
  const dateTo = new Date(selectedDate.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: availableSlots } = useAvailableSlots(dateFrom, dateTo, coaches?.[0]?.id);

  // Generate calendar days for the next 30 days
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Get real available slots for this date
      const daySlots = availableSlots?.filter(slot => slot.date === dateStr) || [];
      const timeSlots: TimeSlot[] = [];
      
      // Get coach's working hours (default to 10-21 if no coach selected)
      const selectedCoach = coaches?.[0]; // First coach (assigned coach)
      const shiftStart = selectedCoach?.shift_start_hour || 10;
      const shiftEnd = selectedCoach?.shift_end_hour || 21;
      
      // Generate time slots based on coach's actual shift hours
      for (let hour = shiftStart; hour <= shiftEnd; hour++) {
        const realSlot = daySlots.find(slot => slot.hour === hour);
        
        let isAvailable = true;
        if (realSlot !== undefined) {
          // Use actual API data
          isAvailable = realSlot.is_available;
        } else {
          // Gym closed during lunch break (12 PM - 2 PM: hours 12 and 13)
          if (hour === 12 || hour === 13) {
            isAvailable = false;
          } else {
            // During coach's working hours: assume available
            isAvailable = true;
          }
        }
        
        timeSlots.push({
          hour,
          available: isAvailable,
          slotId: realSlot?.id || (date.getTime() + hour), // Generate stable slot ID
          coachId: realSlot?.coach_id || coaches?.[0]?.id
        });
      }
      
      days.push({
        date,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        timeSlots
      });
    }
    
    return days;
  }, [selectedDate, coaches, availableSlots]);

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const handleGenerateAISuggestions = async () => {
    console.log('Generating AI suggestions...', { 
      user,
      coaches,
      userId: user?.id, 
      coachId: coaches?.[0]?.id,
      coachesLoading,
      coachesLength: coaches?.length
    });
    
    if (!user?.id) {
      console.error('No user ID available');
      alert('User not authenticated. Please log in again.');
      return;
    }
    
    if (coachesLoading) {
      console.log('Coaches still loading...');
      alert('Loading coach information. Please wait a moment and try again.');
      return;
    }
    
    if (!coaches || coaches.length === 0) {
      console.error('No coaches assigned to this client');
      alert('You need an assigned coach to get AI suggestions. Please contact support to assign a coach.');
      return;
    }
    
    if (!coaches[0]?.id) {
      console.error('Coach ID missing');
      alert('Coach information incomplete. Please contact support.');
      return;
    }

    try {
      console.log('Calling AI suggestions API...');
      const response = await generateSuggestions.mutateAsync({
        client_id: user.id,
        num_sessions: numSessions,
        preferred_date_start: selectedDate.toISOString().split('T')[0],
        days_flexibility: 7
      });

      console.log('AI suggestions received:', response);
      setAiSuggestions(response.suggestions);
      setSelectedSuggestions(response.suggestions.map(s => s.slot_id)); // Auto-select all
      setSessionToken(response.session_token);
      setAiMessage(response.message); // Store the message for display
      
      if (response.suggestions.length === 0) {
        console.warn('No AI suggestions returned.');
        // Show the detailed error message from the backend
        alert(`No suggestions available:\n\n${response.message}`);
      } else if (response.solver_status.startsWith('PARTIAL_SOLUTION')) {
        // Partial solution found - show warning but proceed
        console.warn('Partial solution found:', response.solver_status);
        alert(`Partial solution:\n\n${response.message}`);
      }
    } catch (error) {
      console.error('AI suggestions API failed, using mock data:', error);
      
      // Always show mock suggestions for demo purposes
      const mockSuggestions: AISuggestion[] = [
        {
          slot_id: 1001,
          date: new Date(selectedDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hour: 10,
          coach_id: coaches[0].id,
          confidence_score: 95,
          date_suggestion: new Date(selectedDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          slot_id: 1002,
          date: new Date(selectedDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hour: 14,
          coach_id: coaches[0].id,
          confidence_score: 88,
          date_suggestion: new Date(selectedDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          slot_id: 1003,
          date: new Date(selectedDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hour: 16,
          coach_id: coaches[0].id,
          confidence_score: 92,
          date_suggestion: new Date(selectedDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ];
      
      console.log('Setting mock suggestions:', mockSuggestions);
      setAiSuggestions(mockSuggestions);
      setSelectedSuggestions(mockSuggestions.map(s => s.slot_id)); // Auto-select all
      setSessionToken('mock-session-token-' + Date.now());
    }
  };

  const handleRegenerateAISuggestions = async () => {
    if (!sessionToken) {
      console.error('No session token available for re-suggestion');
      alert('Please generate suggestions first');
      return;
    }
    
    try {
      console.log('Re-suggesting all slots with session:', sessionToken);
      const response = await reSuggestAll.mutateAsync({ sessionToken });
      
      // Update suggestions with new ones
      const typedResponse = response as any;
      if (typedResponse.suggestions) {
        setAiSuggestions(typedResponse.suggestions);
        setSelectedSuggestions(typedResponse.suggestions.map((s: AISuggestion) => s.slot_id)); // Auto-select all new suggestions
        console.log('Updated suggestions after re-suggestion:', typedResponse.suggestions);
      }
    } catch (error) {
      console.error('Failed to re-suggest all slots:', error);
      alert('Failed to generate new suggestions. Please try again.');
    }
  };

  const handleIndividualReSuggest = async (slotId: number) => {
    if (!sessionToken) {
      console.error('No session token available for individual re-suggestion');
      alert('Please generate suggestions first');
      return;
    }
    
    try {
      console.log('Re-suggesting individual slot:', slotId, 'with session:', sessionToken);
      const response = await reSuggestIndividual.mutateAsync({ sessionToken, slotId });
      
      // Update the specific suggestion with the new one
      const typedResponse = response as any;
      if (typedResponse.suggestion) {
        const newSlotId = typedResponse.suggestion.slot_id;
        
        // Update the suggestions array
        setAiSuggestions(prev => prev.map(suggestion => 
          suggestion.slot_id === slotId ? typedResponse.suggestion : suggestion
        ));
        
        // Update selectedSuggestions: if the old slot was selected, select the new one instead
        setSelectedSuggestions(prev => {
          const wasSelected = prev.includes(slotId);
          if (wasSelected) {
            // Replace old slot ID with new slot ID in the selection
            return prev.map(id => id === slotId ? newSlotId : id);
          }
          // If old slot wasn't selected, don't change the selection
          return prev;
        });
        
        console.log('Updated individual suggestion:', typedResponse.suggestion);
        console.log('Updated selection state - replaced slot', slotId, 'with', newSlotId);
      }
    } catch (error) {
      console.error('Failed to re-suggest individual slot:', error);
      alert('Failed to generate new suggestion for this slot. Please try again.');
    }
  };

  const bookSelectedSlots = async () => {
    console.log('Booking validation:', {
      coaches,
      coachId: coaches?.[0]?.id,
      user,
      userId: user?.id,
      selectedSlots: selectedSlots.length,
      aiSuggestions: aiSuggestions.length
    });

    if (!user?.id) {
      console.error('No user ID available');
      alert('User not authenticated. Please log in again.');
      return;
    }

    if (!coaches || coaches.length === 0) {
      console.error('No coaches data available');
      alert('Coach information not loaded. Please refresh the page and try again.');
      return;
    }

    if (!coaches[0]?.id) {
      console.error('Coach ID missing');
      alert('Coach ID missing. Please contact support.');
      return;
    }

    console.log('Starting booking process...', { 
      bookingMode, 
      selectedSlots: selectedSlots.length, 
      aiSuggestions: aiSuggestions.length,
      coachId: coaches[0].id,
      userId: user.id
    });

    try {
      if (bookingMode === 'manual') {
        console.log('Booking manual selections:', selectedSlots);
        
        let lastCreatedBookingId = null;
        // Book manual selections
        for (const slot of selectedSlots) {
          const bookingDateTime = new Date(selectedDate);
          bookingDateTime.setHours(slot.hour, 0, 0, 0);
          
          console.log('Creating booking for:', {
            client_id: user.id,
            coach_id: coaches[0].id,
            date: bookingDateTime.toISOString()
          });
          
          const result = await createBooking.mutateAsync({
            client_id: user.id,
            coach_id: coaches[0].id,
            date: bookingDateTime.toISOString(),
            plan: myPlan?.plan_type || 'Unknown'
          });
          
          console.log('Booking result:', result);
          
          // Store the last booking ID for workout suggestions
          if (result && result.id) {
            lastCreatedBookingId = result.id;
            console.log('Set lastCreatedBookingId to:', lastCreatedBookingId);
          }
        }
        
        // Set the last booking ID for workout suggestions
        if (lastCreatedBookingId) {
          setLastBookingId(lastCreatedBookingId);
          console.log('Set state lastBookingId to:', lastCreatedBookingId);
        }
      } else {
        console.log('Booking selected AI suggestions:', selectedSuggestions);
        
        // Book only selected AI suggestions
        if (sessionToken && selectedSuggestions.length > 0) {
          const result = await bookSelected.mutateAsync({
            session_token: sessionToken,
            selected_slot_ids: selectedSuggestions
          });
          
          // For AI bookings, try to get a booking ID from the result
          if (result && Array.isArray(result) && result.length > 0) {
            setLastBookingId(result[result.length - 1].id || result[0].id);
          }
        } else {
          console.error('No session token or suggestions selected');
          alert(selectedSuggestions.length === 0 ? 'Please select at least one suggestion to book.' : 'Please generate AI suggestions first.');
          return;
        }
      }
      
      const bookedCount = bookingMode === 'manual' ? selectedSlots.length : selectedSuggestions.length;
      
      // Show workout day selection after successful booking
      setShowWorkoutDaySelection(true);
      
      // Reset state
      setSelectedSlots([]);
      if (bookingMode === 'ai') {
        // Remove booked suggestions from the list
        setAiSuggestions(prev => prev.filter(s => !selectedSuggestions.includes(s.slot_id)));
        setSelectedSuggestions([]);
        // Keep session token for potential additional bookings
      }
    } catch (error) {
      console.error('Failed to create bookings:', error);
      
      // Show more detailed error message
      let errorMessage = 'Failed to create bookings. ';
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      alert(errorMessage);
    }
  };

  // Handle plan request submission
  const handlePlanRequest = async () => {
    if (!user?.id || !coaches?.[0]?.id) {
      alert('Missing user or coach information');
      return;
    }

    try {
      await createPlanRequest.mutateAsync({
        client_id: user.id,
        coach_id: coaches[0].id,
        message: planRequestMessage || undefined
      });
      
      setShowPlanRequest(false);
      setPlanRequestMessage('');
      alert('Plan request sent successfully! Your coach will review it and create a plan for you.');
      
      // Redirect to client dashboard
      window.location.href = '/client-dashboard';
      
    } catch (error: any) {
      console.error('Failed to create plan request:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to send plan request. Please try again.';
      
      // Check if it's a duplicate request error
      if (errorMessage.includes('already') || errorMessage.includes('pending')) {
        alert('You already have a pending plan request. Please wait for your coach to respond.');
      } else {
        alert(errorMessage);
      }
    }
  };

  // Loading state
  if (coachesLoading || planLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // No coach assigned
  if (!coaches || coaches.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Coach Assigned</h2>
            <p className="text-gray-600 mb-6">
              You need to select a coach before you can book training sessions.
            </p>
            <button
              onClick={() => window.location.href = '/coach-selection'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select a Coach
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check for pending plan requests
  const hasPendingRequest = myPlanRequests && myPlanRequests.length > 0;

  // No plan assigned - show appropriate message based on plan request status
  if (!myPlan) {
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
                  <span>← Back</span>
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Book Training Sessions</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowWorkoutSuggestions(!showWorkoutSuggestions)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Dumbbell className="h-4 w-4" />
                  <span>Workout Suggestions</span>
                </button>
                <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* No Plan Content */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              {hasPendingRequest ? (
                <>
                  <div className="h-16 w-16 text-blue-400 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Request Pending</h2>
                  <p className="text-gray-600">
                    Wait for your plan to get confirmed by your coach before booking sessions.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Workout Plan Required</h2>
                  <p className="text-gray-600">
                    Request a plan from your coach please first.
                  </p>
                </>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Your Coach</h3>
              <div className="flex items-center space-x-3">
                <div className="bg-blue-200 rounded-full p-2">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">
                    {coaches[0].first_name} {coaches[0].last_name}
                  </p>
                  <p className="text-sm text-blue-600">@{coaches[0].username}</p>
                </div>
              </div>
            </div>

            {hasPendingRequest ? (
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Request Details</h3>
                <p className="text-sm text-blue-700 mb-2">"{myPlanRequests[0].message}"</p>
                <p className="text-xs text-blue-500">
                  Submitted: {new Date(myPlanRequests[0].created_at).toLocaleDateString()}
                </p>
              </div>
            ) : !showPlanRequest ? (
              <div className="text-center">
                <p className="text-gray-600 mb-6">
                  Request a workout plan from your coach to get started with booking sessions.
                </p>
                <button
                  onClick={() => setShowPlanRequest(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span>Request Workout Plan</span>
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Plan Request</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message to Coach (Optional)
                    </label>
                    <textarea
                      value={planRequestMessage}
                      onChange={(e) => setPlanRequestMessage(e.target.value)}
                      placeholder="Tell your coach about your fitness goals, experience level, or any specific preferences..."
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handlePlanRequest}
                      disabled={createPlanRequest.isPending}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                    >
                      {createPlanRequest.isPending ? 'Sending...' : 'Send Request'}
                    </button>
                    <button
                      onClick={() => setShowPlanRequest(false)}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (coachesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your coaches...</p>
        </div>
      </div>
    );
  }

  if (!coaches || coaches.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Coaches Assigned</h2>
          <p className="text-gray-600 mb-6">
            Choose your coach first, then request a plan to get started with your fitness journey.
          </p>
          <button
            onClick={() => window.location.href = '/coach-selection'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select a Coach
          </button>
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
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Book Training Sessions
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.first_name || user?.username}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Time Preferences Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Time Preferences</h2>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showPreferences ? 'Hide' : 'Set Preferences'}
            </button>
          </div>
          
          {showPreferences && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-4">
                Set your preferred training times based on your coach's working hours ({coaches[0].shift_start_hour || 10}:00 - {coaches[0].shift_end_hour || 18}:00)
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Start Time
                  </label>
                  <select
                    value={prefStartHour}
                    onChange={(e) => {
                      const newValue = Number(e.target.value)
                      console.log('Start hour changed from', prefStartHour, 'to', newValue)
                      setPrefStartHour(newValue)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {coaches && coaches[0] && Array.from({length: (coaches[0].shift_end_hour || 22) - (coaches[0].shift_start_hour || 14)}, (_, i) => {
                      const hour = (coaches[0].shift_start_hour || 14) + i
                      return (
                        <option key={hour} value={hour}>
                          {hour}:00
                        </option>
                      )
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred End Time
                  </label>
                  <select
                    value={prefEndHour}
                    onChange={(e) => {
                      const newValue = Number(e.target.value)
                      console.log('End hour changed from', prefEndHour, 'to', newValue)
                      setPrefEndHour(newValue)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {coaches && coaches[0] && Array.from({length: (coaches[0].shift_end_hour || 22) - (coaches[0].shift_start_hour || 14)}, (_, i) => {
                      const hour = (coaches[0].shift_start_hour || 14) + i + 1
                      return (
                        <option key={hour} value={hour}>
                          {hour}:00
                        </option>
                      )
                    })}
                  </select>
                </div>
                
                <div className="flex flex-col justify-center">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isFlexible}
                      onChange={(e) => setIsFlexible(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Flexible (±1 hour)
                    </span>
                  </label>
                  {isFlexible && (
                    <p className="text-xs text-gray-500 mt-1">
                      Show slots 1 hour before/after preferred times
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={async () => {
                    try {
                      const preferenceData = {
                        client_id: user?.id!,
                        preferred_start_hour: prefStartHour,
                        preferred_end_hour: prefEndHour,
                        is_flexible: isFlexible
                      }
                      console.log('Sending preference data:', preferenceData)
                      console.log('Current state - prefStartHour:', prefStartHour, 'prefEndHour:', prefEndHour)
                      
                      await updatePreference.mutateAsync(preferenceData)
                      alert('Preferences saved successfully!')
                      setShowPreferences(false)
                    } catch (error) {
                      alert('Failed to save preferences. Please try again.')
                    }
                  }}
                  disabled={updatePreference.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatePreference.isPending ? 'Saving...' : 'Save Preferences'}
                </button>
                
                <button
                  onClick={() => setShowPreferences(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {myPreference && (
            <div className="text-sm text-gray-600">
              Current: {myPreference.preferred_start_hour}:00 - {myPreference.preferred_end_hour}:00 
              {myPreference.is_flexible && ' (Flexible)'}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Booking Mode Toggle */}
        <div className="mb-8">
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setBookingMode('manual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                bookingMode === 'manual'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-4 w-4 inline-block mr-2" />
              Manual Booking
            </button>
            <button
              onClick={() => setBookingMode('ai')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                bookingMode === 'ai'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Zap className="h-4 w-4 inline-block mr-2" />
              AI Suggestions
            </button>
          </div>
        </div>

        {bookingMode === 'manual' ? (
          /* Manual Booking Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Select Date & Time</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose your preferred training sessions with {coaches[0]?.username || 'your coach'}
                  </p>
                </div>
                
                {/* Calendar Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-7 gap-1 mb-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.slice(0, 21).map((day, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`p-2 text-sm rounded-lg transition-colors ${
                          day.isSelected
                            ? 'bg-blue-600 text-white'
                            : day.isToday
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'hover:bg-gray-50 text-gray-900'
                        }`}
                      >
                        {day.date.getDate()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="p-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">
                      Available Times - {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {calendarDays
                        .find(day => day.date.toDateString() === selectedDate.toDateString())
                        ?.timeSlots.map((slot, index) => (
                        <button
                          key={index}
                          disabled={!slot.available}
                          onClick={() => {
                            console.log('Slot clicked:', { 
                              hour: slot.hour, 
                              available: slot.available,
                              currentSelected: selectedSlots.length,
                              isAlreadySelected: selectedSlots.some(s => s.hour === slot.hour)
                            });
                            
                            if (selectedSlots.some(s => s.hour === slot.hour)) {
                              console.log('Deselecting slot:', slot.hour);
                              setSelectedSlots(prev => prev.filter(s => s.hour !== slot.hour));
                            } else {
                              console.log('Selecting slot:', slot.hour);
                              setSelectedSlots(prev => [...prev, slot]);
                            }
                          }}
                          style={{
                            backgroundColor: !slot.available 
                              ? '#fef2f2' // red-50
                              : selectedSlots.some(s => s.hour === slot.hour)
                              ? '#10b981' // green-500  
                              : '#dbeafe', // blue-50
                            color: !slot.available
                              ? '#ef4444' // red-500
                              : selectedSlots.some(s => s.hour === slot.hour)
                              ? 'white'
                              : '#1d4ed8', // blue-700
                            border: !slot.available
                              ? '1px solid #fecaca' // red-200
                              : selectedSlots.some(s => s.hour === slot.hour)
                              ? '1px solid #10b981' // green-500
                              : '1px solid #bfdbfe', // blue-200
                            cursor: !slot.available ? 'not-allowed' : 'pointer',
                            transform: selectedSlots.some(s => s.hour === slot.hour) ? 'scale(1.05)' : 'scale(1)',
                            boxShadow: selectedSlots.some(s => s.hour === slot.hour) ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                          }}
                          className="p-2 text-xs rounded-md transition-all duration-200 font-medium"
                        >
                          {formatTime(slot.hour)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Booking Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
                
                {selectedSlots.length > 0 ? (
                  <div className="space-y-3">
                    {selectedSlots.map((slot, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatTime(slot.hour)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedDate.toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedSlots(prev => prev.filter(s => s.hour !== slot.hour))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    <button
                      onClick={bookSelectedSlots}
                      disabled={createBooking.isPending}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {createBooking.isPending ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Booking...
                        </>
                      ) : (
                        `Book ${selectedSlots.length} Session${selectedSlots.length !== 1 ? 's' : ''}`
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select time slots to see your booking summary
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* AI Suggestions Mode */
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI-Powered Booking Suggestions</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Get optimized session recommendations based on your preferences and coach availability
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Sessions to book
                      </label>
                      <select
                        value={numSessions}
                        onChange={(e) => setNumSessions(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1}>1 session</option>
                        <option value={2}>2 sessions</option>
                        <option value={3}>3 sessions</option>
                      </select>
                    </div>
                    <button
                      onClick={handleGenerateAISuggestions}
                      disabled={generateSuggestions.isPending}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {generateSuggestions.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          <span>Generate Suggestions</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Display AI response message */}
              {aiMessage && (
                <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-xs">ℹ️</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-800 leading-relaxed">
                        {aiMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6">
                {aiSuggestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Recommended Sessions</h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleRegenerateAISuggestions}
                          disabled={reSuggestAll.isPending}
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${reSuggestAll.isPending ? 'animate-spin' : ''}`} />
                          <span>{reSuggestAll.isPending ? 'Re-suggesting...' : 'Re-suggest'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {aiSuggestions.map((suggestion, index) => (
                        <div key={index} className={`border rounded-lg p-4 transition-colors ${
                          selectedSuggestions.includes(suggestion.slot_id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={selectedSuggestions.includes(suggestion.slot_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSuggestions(prev => [...prev, suggestion.slot_id]);
                                    } else {
                                      setSelectedSuggestions(prev => prev.filter(id => id !== suggestion.slot_id));
                                    }
                                  }}
                                  className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {new Date(suggestion.date_suggestion).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatTime(suggestion.hour)} with {coaches?.[0]?.username || 'Coach'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <button
                                onClick={() => handleIndividualReSuggest(suggestion.slot_id)}
                                disabled={reSuggestIndividual.isPending}
                                className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50"
                              >
                                {reSuggestIndividual.isPending ? 'Re-suggesting...' : 'Re-suggest'}
                              </button>
                              <div className="text-right">
                                <div className="text-sm font-medium text-green-600">
                                  {Math.round(suggestion.confidence_score)}% match
                                </div>
                                <div className="text-xs text-gray-500">AI Confidence</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {selectedSuggestions.length} of {aiSuggestions.length} sessions selected
                        </span>
                        <div className="space-x-2">
                          <button
                            onClick={() => setSelectedSuggestions(aiSuggestions.map(s => s.slot_id))}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => setSelectedSuggestions([])}
                            className="text-gray-600 hover:text-gray-700 text-sm"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={bookSelectedSlots}
                        disabled={bookSelected.isPending || selectedSuggestions.length === 0}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {bookSelected.isPending ? (
                          <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Booking...
                          </>
                        ) : selectedSuggestions.length === 0 ? (
                          'Select sessions to book'
                        ) : (
                          `Book ${selectedSuggestions.length} Selected Session${selectedSuggestions.length !== 1 ? 's' : ''}`
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Click "Generate Suggestions" to get AI-powered booking recommendations
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Workout Suggestions Modal */}
      {showWorkoutSuggestions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Dumbbell className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Suggested Workouts for Your Session
                  </h3>
                </div>
                <button
                  onClick={() => setShowWorkoutSuggestions(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {workoutSuggestionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading workout suggestions...</p>
                </div>
              ) : workoutSuggestions && selectedDayInfo ? (
                <div>
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Training Focus:</strong> {selectedDayInfo.label} | 
                      <strong> Muscle Groups:</strong> {selectedDayInfo.muscles.join(', ')}
                    </p>
                  </div>
                  
                  {(() => {
                    // Filter workouts based on selected day's muscle groups
                    const filteredWorkouts = workoutSuggestions.filter(template => 
                      selectedDayInfo.muscles.some(muscle => 
                        template.muscle_group.toLowerCase().includes(muscle.toLowerCase()) ||
                        muscle.toLowerCase().includes(template.muscle_group.toLowerCase())
                      )
                    );
                    
                    return filteredWorkouts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredWorkouts.map((template) => (
                        <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">{template.name}</h4>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {template.muscle_group}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>{template.sets} sets</span>
                            <span>{template.reps} reps</span>
                          </div>
                          {(template.picture_url || template.video_url) && (
                            <div className="mt-3 flex space-x-2">
                              {template.picture_url && (
                                <a
                                  href={template.picture_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  View Image
                                </a>
                              )}
                              {template.video_url && (
                                <a
                                  href={template.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-green-600 hover:text-green-700"
                                >
                                  Watch Video
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p>No workout templates found for {selectedDayInfo.label}.</p>
                        <p className="text-sm mt-2">Focus: {selectedDayInfo.muscles.join(', ')}</p>
                        <button
                          onClick={() => {
                            setShowWorkoutSuggestions(false);
                            window.location.href = '/workout-templates';
                          }}
                          className="mt-4 text-blue-600 hover:text-blue-700 underline"
                        >
                          Browse All Workouts
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>Unable to load workout suggestions.</p>
                  <button
                    onClick={() => setShowWorkoutSuggestions(false)}
                    className="mt-4 text-blue-600 hover:text-blue-700 underline"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                <button
                  onClick={() => setShowWorkoutSuggestions(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowWorkoutSuggestions(false);
                    window.location.href = '/workout-templates';
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse All Workouts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Workout Day Selection Modal */}
      {showWorkoutDaySelection && myPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Dumbbell className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    What are you training today?
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Choose your workout focus for this session based on your {myPlan.plan_type} plan
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {PLAN_WORKOUT_DAYS[myPlan.plan_type as keyof typeof PLAN_WORKOUT_DAYS]?.map((day) => (
                  <button
                    key={day.key}
                    onClick={async () => {
                      setSelectedWorkoutDay(day.key);
                      
                      // Update the booking with the selected workout day
                      if (lastBookingId) {
                        try {
                          await updateBookingWorkout.mutateAsync({
                            bookingId: lastBookingId,
                            workoutDay: `${day.label} - ${day.muscles.join(', ')}`
                          });
                        } catch (error) {
                          console.error('Failed to update booking workout:', error);
                        }
                      }
                      
                      setShowWorkoutDaySelection(false);
                      setShowWorkoutSuggestions(true);
                    }}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{day.label}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Focus: {day.muscles.join(', ')}
                        </p>
                      </div>
                      <div className="text-blue-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
                
                {/* Add "Ask Coach" option */}
                <button
                  onClick={async () => {
                    // Set coach decision requested
                    if (lastBookingId) {
                      try {
                        await updateBookingWorkout.mutateAsync({
                          bookingId: lastBookingId,
                          workoutDay: "Coach will decide"
                        });
                      } catch (error) {
                        console.error('Failed to update booking workout:', error);
                      }
                    }
                    
                    setShowWorkoutDaySelection(false);
                    alert('Coach has been notified to choose your workout focus. You will receive a notification once decided.');
                  }}
                  className="w-full text-left p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-700">Ask Coach to Decide</h4>
                      <p className="text-sm text-blue-600 mt-1">
                        Let your coach choose the best workout focus for today
                      </p>
                    </div>
                    <div className="text-blue-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowWorkoutDaySelection(false)}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-700 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingPage;