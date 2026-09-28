import { io } from 'socket.io-client';

// Use the deployed backend URL if provided, otherwise default to localhost for development
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Single shared socket instance
const socket = io(BACKEND_URL, { autoConnect: true });
export default socket;
