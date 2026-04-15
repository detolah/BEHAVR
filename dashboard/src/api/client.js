import axios from 'axios';

const client = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' });

client.interceptors.request.use(config => {
  const token = localStorage.getItem('behavr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      localStorage.removeItem('behavr_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
