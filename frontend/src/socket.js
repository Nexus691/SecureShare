import { io } from 'socket.io-client';

// Use the deployed backend URL if provided, otherwise default to localhost for development
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Single shared socket instance
const socket = io(BACKEND_URL, {
  autoConnect: true,
  withCredentials: true,
  transports: ['websocket'], // Force WebSockets to avoid Render's HTTP 429 rate limits on polling
});

export function registerSocketUser(userId) {
  if (userId) socket.emit('register-user', userId);
}

export default socket;
