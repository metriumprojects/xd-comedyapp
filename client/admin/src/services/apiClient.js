import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Always default to the live Render API so the admin panel works even when
// the local backend is offline. Override with REACT_APP_API_BASE_URL if you
// need to point at localhost during backend development.
export const API_BASE =
  process.env.REACT_APP_API_BASE_URL || 'https://comedyapp.onrender.com/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  // Render free tier can cold-start; give it enough time.
  timeout: 30000,
});

console.log('[Admin API] baseURL =', API_BASE);

// Add token to headers
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    throw err;
  }
);

export default apiClient;
