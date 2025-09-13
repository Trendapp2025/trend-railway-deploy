/**
 * Centralized API configuration
 * This file manages the base URL for all API calls
 */

// Determine the API base URL based on environment
const getApiBaseUrl = (): string => {
  // Check if we're in development (localhost)
  if (typeof window !== 'undefined') {
    // Client-side: check if we're on localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    // Production: use the same domain as the frontend
    return window.location.origin;
  }
  
  // Server-side: use environment variable or default
  return process.env.API_BASE_URL || 'https://web-production-88309.up.railway.app';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Assets
  ASSETS: () => buildApiUrl('/api/assets'),
  ASSET_PRICE: (symbol: string) => buildApiUrl(`/api/assets/${encodeURIComponent(symbol)}/price`),
  ASSET_LIVE_PRICE: (symbol: string) => buildApiUrl(`/api/assets/${encodeURIComponent(symbol)}/live-price`),
  
  // Auth
  LOGIN: () => buildApiUrl('/api/auth/login'),
  REGISTER: () => buildApiUrl('/api/auth/register'),
  LOGOUT: () => buildApiUrl('/api/auth/logout'),
  
  // Predictions
  PREDICTIONS: () => buildApiUrl('/api/predictions'),
  PREDICTION: (id: string) => buildApiUrl(`/api/predictions/${id}`),
  
  // User
  USER_PROFILE: () => buildApiUrl('/api/user/profile'),
  USER_PREDICTIONS: () => buildApiUrl('/api/user/predictions'),
} as const;

// Debug helper
export const logApiConfig = () => {
  console.log('API Configuration:', {
    baseUrl: API_BASE_URL,
    isLocalhost: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'),
    currentHost: typeof window !== 'undefined' ? window.location.hostname : 'server-side'
  });
};
