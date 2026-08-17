import { io } from 'socket.io-client';

// Single shared socket instance
const socket = io('http://localhost:3000', { autoConnect: true });
export default socket;
