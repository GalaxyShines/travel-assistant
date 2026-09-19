import axios from 'axios';
import { appConfig } from '../config';

const AUTH_TOKEN_KEY = 'travel-helper-auth-token';
let unauthorizedHandler = null;

const api = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 15000
});

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    const requestUrl = error.config?.url || '';
    if (error.response?.status === 401 && !requestUrl.includes('/auth/login')) {
      clearAuthToken();
      unauthorizedHandler?.(message);
    }
    return Promise.reject(new Error(message));
  }
);

function unwrap(request) {
  return request.then((response) => response.data?.data ?? null);
}

export const authApi = {
  login: (payload) => unwrap(api.post('/auth/login', payload)),
  validate: () => unwrap(api.get('/auth/session'))
};

export const tripApi = {
  list: () => unwrap(api.get('/trips')),
  create: (payload) => unwrap(api.post('/trips', payload)),
  update: (id, payload) => unwrap(api.put(`/trips/${id}`, payload)),
  remove: (id) => api.delete(`/trips/${id}`)
};

export const placeApi = {
  list: (tripId) => unwrap(api.get(`/trips/${tripId}/places`)),
  create: (tripId, payload) => unwrap(api.post(`/trips/${tripId}/places`, payload)),
  update: (id, payload) => unwrap(api.put(`/places/${id}`, payload)),
  remove: (id) => api.delete(`/places/${id}`)
};

export const routeApi = {
  list: (tripId) => unwrap(api.get(`/trips/${tripId}/routes`)),
  create: (tripId, payload) => unwrap(api.post(`/trips/${tripId}/routes`, payload)),
  update: (id, payload) => unwrap(api.put(`/routes/${id}`, payload)),
  remove: (id) => api.delete(`/routes/${id}`)
};
