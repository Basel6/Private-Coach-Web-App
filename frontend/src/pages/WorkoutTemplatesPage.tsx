import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDbWorkoutTemplates, type DbWorkoutTemplate } from '@/hooks/useWorkouts';

// Available muscle groups for filtering
const MUSCLE_GROUPS = [
  'All',
  'Chest',
  'Back', 
  'Shoulders',
  'Arms',
  'Biceps',
  'Triceps',
  'Legs',
  'Quads',
  'Hamstrings',
  'Calves',
  'Glutes',
  'Core',
  'Abs'
];

export default function WorkoutTemplatesPage() {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('All');

  // Fetch workout templates
  const { data: templates, isLoading, error } = useDbWorkoutTemplates(
    selectedMuscleGroup === 'All' ? undefined : selectedMuscleGroup
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <span>← Back to Home</span>
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Workout Templates
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Explore Our Workout Templates
          </h1>
          <p className="text-gray-600">
            Discover our comprehensive collection of professional workout exercises, 
            complete with detailed instructions and video guides.
          </p>
        </div>

        {/* Muscle Group Filter */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter by Muscle Group</h3>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedMuscleGroup(group)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedMuscleGroup === group
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading workout templates...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-gray-600">Failed to load workout templates. Please try again.</p>
          </div>
        )}

        {/* Workout Templates Grid */}
        {templates && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {templates.length} workout{templates.length !== 1 ? 's' : ''} 
              {selectedMuscleGroup !== 'All' && ` for ${selectedMuscleGroup}`}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates?.map((template: DbWorkoutTemplate) => (
                <div key={template.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Exercise Image/Video */}
                  <div className="aspect-video bg-gray-200 relative">
                    {template.picture_url ? (
                      <img
                        src={template.picture_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-2">💪</div>
                          <p className="text-gray-500 text-sm">No image available</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Video Play Button */}
                    {template.video_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <a
                          href={template.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-black bg-opacity-70 text-white rounded-full p-4 hover:bg-opacity-80 transition-opacity"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Exercise Info */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {template.muscle_group}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {template.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-gray-500">Sets:</span>
                          <span className="ml-1 font-medium">{template.sets}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Reps:</span>
                          <span className="ml-1 font-medium">{template.reps}</span>
                        </div>
                      </div>
                      
                      {template.video_url && (
                        <a
                          href={template.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Watch Video
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {templates.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workouts found</h3>
                <p className="text-gray-600">
                  No workout templates found for {selectedMuscleGroup}. Try selecting a different muscle group.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}