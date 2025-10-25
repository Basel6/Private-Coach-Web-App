import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/lib/api'
import { useCreateOrUpdatePreference } from '@/hooks/useSchedule'

interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar: string | null
  time_preferences: {
    preferred_start_time: string | null
    preferred_end_time: string | null
    preferred_days: string[]
  } | null
}

interface TimePreferences {
  preferred_start_time: number | null  // Hour (e.g. 14 for 2 PM)
  preferred_end_time: number | null   // Hour (e.g. 18 for 6 PM)
  preferred_days: string[]
}

export default function Profile() {
  const { user, logout } = useAuthStore()
  const updatePreference = useCreateOrUpdatePreference()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
  })
  
  const [avatarUrl, setAvatarUrl] = useState('')
  
  const [timePreferences, setTimePreferences] = useState<TimePreferences>({
    preferred_start_time: null,
    preferred_end_time: null,
    preferred_days: []
  })
  
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Fetch profile data
  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const data = await apiClient.get<UserProfile>('/users/profile')
      setProfile(data)
      setFormData({
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
      })
      setAvatarUrl(data.avatar || '')
      
      // Convert time preferences from string format to hour format
      if (data.time_preferences) {
        const startHour = data.time_preferences.preferred_start_time 
          ? parseInt(data.time_preferences.preferred_start_time.split(':')[0]) 
          : null
        const endHour = data.time_preferences.preferred_end_time 
          ? parseInt(data.time_preferences.preferred_end_time.split(':')[0]) 
          : null
          
        setTimePreferences({
          preferred_start_time: startHour,
          preferred_end_time: endHour,
          preferred_days: data.time_preferences.preferred_days || []
        })
      } else {
        setTimePreferences({
          preferred_start_time: null,
          preferred_end_time: null,
          preferred_days: []
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check if profile is incomplete
  const isProfileIncomplete = () => {
    if (!profile) return false
    return !profile.first_name || !profile.last_name || !profile.phone
  }

  const getMissingFields = () => {
    if (!profile) return []
    const missing = []
    if (!profile.first_name) missing.push('First Name')
    if (!profile.last_name) missing.push('Last Name')
    if (!profile.phone) missing.push('Phone Number')
    return missing
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      await apiClient.put('/users/profile', formData)
      alert('Profile updated successfully!')
      fetchProfile() // Refresh data
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpdate = async () => {
    if (!avatarUrl.trim()) {
      alert('Please enter a valid avatar URL or paste image data')
      return
    }

    setSaving(true)
    try {
      console.log('Attempting avatar update...')
      
      // Validate the input
      const trimmedUrl = avatarUrl.trim()
      let isValidInput = false
      let inputType = 'unknown'
      
      // Check if it's a valid URL
      try {
        new URL(trimmedUrl)
        isValidInput = true
        inputType = 'URL'
        console.log('Input is a valid URL')
      } catch {
        // Check if it's base64 data
        if (trimmedUrl.startsWith('data:image/')) {
          isValidInput = true
          inputType = 'base64'
          console.log('Input is base64 image data, length:', trimmedUrl.length)
        }
      }
      
      if (!isValidInput) {
        alert('Please enter a valid image URL (http://... or https://...) or paste base64 image data (data:image/...)')
        return
      }
      
      // Send only the avatar field
      const updateData = { avatar: trimmedUrl }
      console.log(`Sending ${inputType} avatar update...`)
      
      const response = await apiClient.put('/users/profile', updateData)
      console.log('Avatar update response:', response)
      alert('Avatar updated successfully!')
      fetchProfile() // Refresh data
    } catch (error) {
      console.error('Detailed error updating avatar:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('Data too long') || error.message.includes('1406')) {
          alert('Avatar data is too large for the database. Please:\n• Use a smaller image\n• Use an image URL instead\n• Or contact admin to increase database limits')
        } else if (error.message.includes('500')) {
          alert('Server error updating avatar. Please check the backend logs.')
        } else {
          alert(`Failed to update avatar: ${error.message}`)
        }
      } else {
        alert('Failed to update avatar: Unknown error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTimePreferencesUpdate = async () => {
    try {
      // 1. First update the users table time_preferences
      const timePrefsForBackend = {
        preferred_start_time: timePreferences.preferred_start_time 
          ? `${timePreferences.preferred_start_time.toString().padStart(2, '0')}:00` 
          : null,
        preferred_end_time: timePreferences.preferred_end_time 
          ? `${timePreferences.preferred_end_time.toString().padStart(2, '0')}:00` 
          : null,
        preferred_days: timePreferences.preferred_days
      }
      
      await apiClient.put('/users/profile', { time_preferences: timePrefsForBackend })
      
      // 2. Also update the client_preferences table using the same method as booking page
      if (timePreferences.preferred_start_time && timePreferences.preferred_end_time && user?.id) {
        const preferenceData = {
          client_id: user.id,
          preferred_start_hour: timePreferences.preferred_start_time,
          preferred_end_hour: timePreferences.preferred_end_time,
          is_flexible: true
        }
        
        // Use the same hook that booking page uses
        await updatePreference.mutateAsync(preferenceData)
      }
      
      alert('Time preferences updated successfully!')
      fetchProfile() // Refresh data
    } catch (error) {
      console.error('Error updating time preferences:', error)
      alert('Failed to update time preferences')
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('New passwords do not match')
      return
    }
    
    try {
      await apiClient.put('/users/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      
      alert('Password changed successfully!')
      setShowPasswordChange(false)
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Failed to change password')
    }
  }

  const handleTimePreferenceToggle = (timeSlot: string) => {
    setTimePreferences(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(timeSlot)
        ? prev.preferred_days.filter(t => t !== timeSlot)
        : [...prev.preferred_days, timeSlot]
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                My Profile
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.username}
              </span>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Dashboard
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Profile Completion Warning */}
        {isProfileIncomplete() && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Incomplete Profile
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Please complete your profile to get the best experience. Missing fields: {getMissingFields().join(', ')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Picture Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
              <div className="text-center">
                <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-4xl mx-auto mb-4">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-full object-cover"
                    />
                  ) : (
                    formData.username?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="space-y-3">
                  <textarea
                    placeholder="Profile picture URL or image data"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleAvatarUpdate}
                    disabled={saving}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Avatar'}
                  </button>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>You can use:</strong></p>
                    <p>• Image URL: https://example.com/avatar.jpg</p>
                    <p>• Base64 data: data:image/jpeg;base64,...</p>
                    <p>• Leave empty for default avatar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="e.g., +1-234-567-8900"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Update Profile'}
                </button>
              </form>
            </div>

            {/* Time Preferences - Only for clients */}
            {user?.role === 'CLIENT' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Preferences</h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Start Time
                      </label>
                      <select
                        value={timePreferences.preferred_start_time || ''}
                        onChange={(e) => setTimePreferences({
                          ...timePreferences, 
                          preferred_start_time: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select start time</option>
                        {Array.from({length: 14}, (_, i) => {
                          const hour = 8 + i // 8 AM to 9 PM
                          return (
                            <option key={hour} value={hour}>
                              {hour}:00 {hour < 12 ? 'AM' : 'PM'}
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
                        value={timePreferences.preferred_end_time || ''}
                        onChange={(e) => setTimePreferences({
                          ...timePreferences, 
                          preferred_end_time: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select end time</option>
                        {Array.from({length: 14}, (_, i) => {
                          const hour = 9 + i // 9 AM to 10 PM
                          return (
                            <option key={hour} value={hour}>
                              {hour}:00 {hour < 12 ? 'AM' : 'PM'}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Days
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <label key={day} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={timePreferences.preferred_days.includes(day)}
                            onChange={() => handleTimePreferenceToggle(day)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleTimePreferencesUpdate}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Save Time Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Password Change */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Security</h2>
                {!showPasswordChange && (
                  <button
                    onClick={() => setShowPasswordChange(true)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {showPasswordChange && (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L18 18" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L18 18" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L18 18" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Change Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false)
                        setPasswordData({
                          current_password: '',
                          new_password: '',
                          confirm_password: ''
                        })
                      }}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}