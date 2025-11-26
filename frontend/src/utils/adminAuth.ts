/**
 * Admin Authentication Utilities
 * Handles JWT token storage, validation, and API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://bts-blocktrust.onrender.com';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  status: string;
  user: AdminUser;
  access_token: string;
  refresh_token: string;
}

/**
 * Store tokens in localStorage (encrypted in production)
 */
export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('admin_access_token', accessToken);
  localStorage.setItem('admin_refresh_token', refreshToken);
};

/**
 * Get access token from localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('admin_access_token');
};

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem('admin_refresh_token');
};

/**
 * Remove tokens from localStorage
 */
export const clearTokens = () => {
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
};

/**
 * Store user info in localStorage
 */
export const setUser = (user: AdminUser) => {
  localStorage.setItem('admin_user', JSON.stringify(user));
};

/**
 * Get user info from localStorage
 */
export const getUser = (): AdminUser | null => {
  const userStr = localStorage.getItem('admin_user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = getAccessToken();
  const user = getUser();
  return !!token && !!user;
};

/**
 * Check if user is superadmin
 */
export const isSuperadmin = (): boolean => {
  const user = getUser();
  return user?.role === 'superadmin';
};

/**
 * Login admin user
 */
export const loginAdmin = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data: LoginResponse = await response.json();
  
  // Store tokens and user info
  setTokens(data.access_token, data.refresh_token);
  setUser(data.user);
  
  return data;
};

/**
 * Logout admin user
 */
export const logoutAdmin = async (): Promise<void> => {
  const token = getAccessToken();
  
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  clearTokens();
};

/**
 * Make authenticated API request
 */
export const adminFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('No access token');
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (response.status === 401) {
    // Token expired, logout
    clearTokens();
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
};

