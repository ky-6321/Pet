import { io } from 'socket.io-client';

// In production APP_URL will be injected by AI Studio.
// In development, the socket IO connects to the same host automatically when omitting the URL.
export const socket = io({
  autoConnect: true,
});
