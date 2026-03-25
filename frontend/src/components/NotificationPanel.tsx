import React, { useRef, useEffect, useState } from 'react';
import { Bell, X, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotificationStore, AppNotification } from '../store/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeConfig = {
  critical: { icon: <AlertCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  warning: { icon: <AlertTriangle size={14} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  info: { icon: <Info size={14} />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  success: { icon: <CheckCircle size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const NotificationItem: React.FC<{ notification: AppNotification; onMarkRead: (id: string) => void }> = ({
  notification,
  onMarkRead,
}) => {
  const cfg = typeConfig[notification.type] || typeConfig.info;
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR });
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-700/40 ${
        notification.isRead ? 'opacity-60' : ''
      } ${cfg.bg}`}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
    >
      <span className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium leading-tight">{notification.title}</p>
        <p className="text-gray-400 text-xs mt-0.5 leading-snug line-clamp-2">{notification.message}</p>
        {timeAgo && <p className="text-gray-600 text-xs mt-1">{timeAgo}</p>}
      </div>
      {!notification.isRead && (
        <span className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full mt-1" />
      )}
    </div>
  );
};

const NotificationPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-emerald-400" />
              <span className="text-white text-sm font-semibold">Notificações</span>
              {unreadCount > 0 && (
                <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-400 transition-colors"
              >
                <CheckCheck size={12} />
                Marcar tudo como lido
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
                Limpar tudo
              </button>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell size={32} className="text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma notificação</p>
                <p className="text-gray-700 text-xs mt-1">Novos alertas e eventos aparecerão aqui</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} onMarkRead={markAsRead} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
