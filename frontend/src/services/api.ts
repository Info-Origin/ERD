import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:4001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach connection token if present
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('db_connection_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 / connection expiry
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    const errorMessage: string =
      error.response?.data?.message || error.message || 'An error occurred';

    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: errorMessage,
    });

    if (error.response?.status === 401) {
      const message: string = error.response?.data?.message || '';
      if (message.includes('expired') || message.includes('Invalid connection token')) {
        sessionStorage.removeItem('db_connection_token');
        sessionStorage.removeItem('db_connection_info');
        window.dispatchEvent(
          new CustomEvent('connection-expired', { detail: { message: errorMessage } }),
        );
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
