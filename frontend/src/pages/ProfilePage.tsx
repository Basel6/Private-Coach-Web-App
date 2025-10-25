import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/lib/api'

interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  avatar?: string
  time_preferences?: {
    preferred_start_time: string
    preferred_end_time: string
    preferred_days: string[]
  }
}

interface PasswordChange {
  current_password: string
  new_password: string
  confirm_password: string
}

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
    preferred_start_time: '09:00',
    preferred_end_time: '18:00',
    preferred_days: [] as string[]
  })
  
  const [passwordData, setPasswordData] = useState<PasswordChange>({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const weekDays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ]

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get<UserProfile>('/users/profile')
      setProfile(response)
      setFormData({
        username: response.username || '',
        first_name: response.first_name || '',
        last_name: response.last_name || '',
        phone: response.phone || '',
        preferred_start_time: response.time_preferences?.preferred_start_time || '09:00',
        preferred_end_time: response.time_preferences?.preferred_end_time || '18:00',
        preferred_days: response.time_preferences?.preferred_days || []
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setErrors({})
    
    try {
      const updateData = {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        time_preferences: {
          preferred_start_time: formData.preferred_start_time,
          preferred_end_time: formData.preferred_end_time,
          preferred_days: formData.preferred_days
        }
      }
      
      const response = await apiClient.put<UserProfile>('/users/profile', updateData)
      setProfile(response)
      setIsEditing(false)
      alert('Profile updated successfully!')
    } catch (error: any) {
      console.error('Error updating profile:', error)
      if (error.response?.data?.detail) {
        setErrors({ general: error.response.data.detail })
      } else {
        setErrors({ general: 'Failed to update profile. Please try again.' })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setErrors({})
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setErrors({ password: 'New passwords do not match' })
      return
    }
    
    if (passwordData.new_password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters long' })
      return
    }
    
    try {
      await apiClient.put('/users/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })
      
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      setShowPasswordForm(false)
      alert('Password changed successfully!')
    } catch (error: any) {
      console.error('Error changing password:', error)
      if (error.response?.data?.detail) {
        setErrors({ password: error.response.data.detail })
      } else {
        setErrors({ password: 'Failed to change password. Please try again.' })
      }
    }
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day]
    }))
  }

  const generateAvatar = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading profile...</p>
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
              <h1 className="text-xl font-semibold text-gray-900">
                My Profile
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition duration-200"
              >
                Back to Dashboard
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Profile Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {generateAvatar(profile?.first_name || profile?.username || 'U')}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.first_name} {profile?.last_name} 
                  {(!profile?.first_name && !profile?.last_name) && profile?.username}
                </h2>
                <p className="text-gray-600">{profile?.email}</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                  {user?.role}
                </span>
              </div>
              <div className="ml-auto">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition duration-200"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="space-x-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition duration-200"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setErrors({})
                        fetchProfile() // Reset form data
                      }}
                      className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6 space-y-6">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{profile?.username}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (Read-only)
                  </label>
                  <p className="text-gray-600 py-2 bg-gray-50 px-3 rounded-md">{profile?.email}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{profile?.first_name || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{profile?.last_name || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1234567890"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{profile?.phone || 'Not set'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Time Preferences */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Time Preferences</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Start Time
                    </label>
                    {isEditing ? (
                      <input
                        type="time"
                        value={formData.preferred_start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, preferred_start_time: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.preferred_start_time}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred End Time
                    </label>
                    {isEditing ? (
                      <input
                        type="time"
                        value={formData.preferred_end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, preferred_end_time: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.preferred_end_time}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Days
                  </label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {weekDays.map(day => (
                        <label key={day.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.preferred_days.includes(day.value)}
                            onChange={() => handleDayToggle(day.value)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-900 py-2">
                      {formData.preferred_days.length > 0 
                        ? formData.preferred_days.map(day => 
                            weekDays.find(d => d.value === day)?.label
                          ).join(', ')
                        : 'No preferences set'
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Security</h3>
              <div>
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 transition duration-200"
                  >
                    Change Password
                  </button>
                ) : (
                  <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-gray-900">Change Password</h4>
                      <button
                        onClick={() => {
                          setShowPasswordForm(false)
                          setPasswordData({
                            current_password: '',
                            new_password: '',
                            confirm_password: ''
                          })
                          setErrors({})
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {errors.password && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-red-800 text-sm">{errors.password}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={handlePasswordChange}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition duration-200"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}