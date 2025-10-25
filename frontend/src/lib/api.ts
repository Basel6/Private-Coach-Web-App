const API_BASE_URL = 'http://localhost:8000'

console.log('🔧 API_BASE_URL is set to:', API_BASE_URL)

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
    console.log('🔧 ApiClient constructor - baseURL:', baseURL)
    console.log('🔧 ApiClient constructor - this.baseURL:', this.baseURL)
    // Initialize token from localStorage
    this.token = localStorage.getItem('token')
    console.log('API Client initialized with token:', this.token ? 'Present' : 'Missing')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    console.log('🔧 Making request to URL:', url)
    console.log('🔧 this.baseURL:', this.baseURL)
    console.log('🔧 endpoint:', endpoint)
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Always get fresh token from localStorage
    const currentToken = localStorage.getItem('token')
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`
      console.log('Making API request with fresh token:', currentToken.substring(0, 20) + '...')
    } else {
      console.log('Making API request without token!')
    }

    console.log('API Request:', {
      method: options.method || 'GET',
      url,
      headers: { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : undefined }
    })

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        errorData
      })
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(userData: {
    email: string
    password: string
    full_name: string
    role: string
  }) {
    // Convert frontend data to backend format
    const backendData = {
      username: userData.full_name, // Backend expects username
      email: userData.email,
      password: userData.password,
      role: userData.role, // Should be "CLIENT" or "COACH"
    }
    return this.request<any>('/users/register', {
      method: 'POST',
      body: JSON.stringify(backendData),
    })
  }

  async getCurrentUser() {
    // Use the profile endpoint to get full user data including avatar
    return this.request<any>('/users/profile')
  }

  // GET method
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint)
  }

  // POST method
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // PUT method
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // DELETE method
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)