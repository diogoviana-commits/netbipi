import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { token, isAuthenticated } = useAuthStore();
  const { addNotification, incrementUnread } = useNotificationStore();

  const connect = useCallback(() => {
    if (!token || socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Conectado:', socket.id);
    });

    socket.on('new_alert', (data) => {
      const alert = data.data;
      const severity = alert?.severity;
      const isCritical = severity === 'disaster' || severity === 'high';

      toast(
        isCritical
          ? `Novo Alerta Crítico: ${alert?.trigger_name || 'Alerta recebido'}`
          : `Novo Alerta: ${alert?.trigger_name || 'Alerta recebido'}`,
        {
          duration: isCritical ? 8000 : 4000,
          style: {
            background: isCritical ? '#7f1d1d' : '#1e3a5f',
            border: `1px solid ${isCritical ? '#dc2626' : '#3b82f6'}`,
            color: 'white',
          },
        }
      );

      addNotification({
        id: Date.now().toString(),
        title: 'Novo Alerta',
        message: alert?.trigger_name || 'Alerta recebido do Zabbix',
        type: isCritical ? 'critical' : 'warning',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      incrementUnread();
    });

    socket.on('alert_resolved', (data) => {
      toast.success(`Alerta resolvido: ${data.alertId}`, {
        style: { background: '#064e3b', border: '1px solid #059669', color: 'white' },
      });
    });

    socket.on('new_ticket', (data) => {
      const ticket = data.data;
      toast(`Novo chamado: ${ticket?.title || 'Chamado criado'}`, {
        style: { background: '#1e3a5f', color: 'white', border: '1px solid #3b82f6' },
        duration: 4000,
      });
      addNotification({
        id: Date.now().toString(),
        title: 'Novo Chamado',
        message: ticket?.title || 'Chamado criado',
        type: 'info',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      incrementUnread();
    });

    socket.on('escalation', (data) => {
      toast.error(`Escalada: ${data.data?.message || 'Escalada de incidente'}`, { duration: 10000 });
      addNotification({
        id: Date.now().toString(),
        title: 'Escalada de Incidente',
        message: data.data?.message || 'Incidente escalado',
        type: 'critical',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      incrementUnread();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Desconectado:', reason);
    });

    socketRef.current = socket;
  }, [token, addNotification, incrementUnread]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    if (isAuthenticated) connect();
    else disconnect();
    return () => { disconnect(); };
  }, [isAuthenticated, connect, disconnect]);

  return { socket: socketRef.current, connect, disconnect };
};
