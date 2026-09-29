import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const socket = io(BACKEND_URL, {
  autoConnect: true,
  withCredentials: true,
  transports: ['websocket'],
});

export function registerSocketUser(userId) {
  if (userId) socket.emit('register-user', userId);
}

export default socket;
