import { io, Socket } from 'socket.io-client';
import { MutableRefObject } from 'react';

let socket: Socket | null = null;
let warmPromise: Promise<void> | null = null;

async function warmSocketServer() {
  if (!warmPromise) {
    warmPromise = fetch('/api/socket').then(() => undefined).catch(() => undefined);
  }
  await warmPromise;
}

export function getSocket(): Socket {
  if (!socket) {
    void warmSocketServer();
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socket',
      transports: ['websocket']
    });
  }
  return socket;
}

export function ensureSocket(ref: MutableRefObject<Socket | null>): Socket {
  if (!ref.current) {
    ref.current = getSocket();
  }
  return ref.current;
}
