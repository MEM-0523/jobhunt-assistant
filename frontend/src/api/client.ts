import axios from 'axios';

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isLocalTunnel = (import.meta.env.VITE_API_URL || '').includes('loca.lt');

const client = axios.create({
  baseURL: isDev ? '/api' : (import.meta.env.VITE_API_URL || '/api'),
  headers: {
    'Content-Type': 'application/json',
    ...(isLocalTunnel ? { 'Bypass-Tunnel-Reminder': '1' } : {}),
  },
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      console.error('无法连接后端服务，请确认后端已启动');
    }
    return Promise.reject(error);
  }
);

export default client;