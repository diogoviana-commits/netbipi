import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JWTPayload } from '../types';

let io: SocketServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Token obrigatório'));
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      (socket as unknown as Record<string, unknown>).user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as unknown as Record<string, unknown>).user as JWTPayload;
    console.log(`[Socket] Usuário conectado: ${user?.userId} (${socket.id})`);
    socket.join(`user:${user?.userId}`);
    socket.join('all');

    socket.on('disconnect', () => {
      console.log(`[Socket] Usuário desconectado: ${user?.userId}`);
    });

    socket.on('acknowledge_alert', (data) => {
      socket.to('all').emit('alert_acknowledged', data);
    });
  });

  return io;
};

export const getIO = (): SocketServer | null => io;

// Emit to all connected users
export const emitToAll = (event: string, data: unknown): void => {
  io?.to('all').emit(event, data);
};

// Emit new alert
export const emitNewAlert = (alert: unknown): void => {
  emitToAll('new_alert', { type: 'new_alert', data: alert, timestamp: new Date().toISOString() });
};

// Emit alert resolved
export const emitAlertResolved = (alertId: string): void => {
  emitToAll('alert_resolved', { type: 'alert_resolved', alertId, timestamp: new Date().toISOString() });
};

// Emit new ticket
export const emitNewTicket = (ticket: unknown): void => {
  emitToAll('new_ticket', { type: 'new_ticket', data: ticket, timestamp: new Date().toISOString() });
};

// Emit escalation
export const emitEscalation = (data: unknown): void => {
  emitToAll('escalation', { type: 'escalation', data, timestamp: new Date().toISOString() });
};
