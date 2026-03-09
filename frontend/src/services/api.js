import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4001/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add connection token if available
    const token = sessionStorage.getItem('db_connection_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMessage =
      error.response?.data?.message || error.message || "An error occurred";

    console.error("API Error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: errorMessage,
    });

    // Handle connection expired errors
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || '';
      
      if (message.includes('expired') || message.includes('Invalid connection token')) {
        // Clear connection data
        sessionStorage.removeItem('db_connection_token');
        sessionStorage.removeItem('db_connection_info');
        
        // Trigger a reconnection event
        window.dispatchEvent(new CustomEvent('connection-expired', {
          detail: { message: errorMessage }
        }));
      }
    }

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
  },
);

export default api;
