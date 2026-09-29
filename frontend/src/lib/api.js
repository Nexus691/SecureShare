const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const API_BASE = import.meta.env.VITE_API_BASE || `${BACKEND_URL.replace(/\/$/, '')}/api`;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {

  register: (email, password, displayName) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  me: () =>
    request('/auth/me'),
  updateProfile: (data) =>
    request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getFriends: () => request('/friends'),
  getFriendRequests: () => request('/friends/requests'),
  sendFriendRequest: (email) =>
    request('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  acceptFriendRequest: (requestId) =>
    request(`/friends/accept/${requestId}`, { method: 'POST' }),
  declineFriendRequest: (requestId) =>
    request(`/friends/decline/${requestId}`, { method: 'POST' }),
  removeFriend: (friendUserId) =>
    request(`/friends/${friendUserId}`, { method: 'DELETE' }),

  getHistory: () => request('/history'),
  logHistory: (data) => request('/history', { method: 'POST', body: JSON.stringify(data) }),

  getNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/notifications${query ? `?${query}` : ''}`);
  },
  getUnreadNotificationCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
};

export const updateProfile = (data) => api.updateProfile(data);
