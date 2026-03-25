import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, Ticket, MessageSquare,
  Network, Activity, Clock, Loader2,
} from 'lucide-react';
import { timelineApi } from '../services/api';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  user?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  alertId?: string;
  ticketId?: string;
}

const typeConfig: Record<string, { icon: React.ReactNode; dotColor: string; lineColor: string }> = {
  alert_created: {
    icon: <AlertTriangle size={14} />,
    dotColor: 'bg-red-500',
    lineColor: 'text-red-400',
  },
  alert_acknowledged: {
    icon: <CheckCircle size={14} />,
    dotColor: 'bg-blue-500',
    lineColor: 'text-blue-400',
  },
  alert_resolved: {
    icon: <CheckCircle size={14} />,
    dotColor: 'bg-emerald-500',
    lineColor: 'text-emerald-400',
  },
  ticket_opened: {
    icon: <Ticket size={14} />,
    dotColor: 'bg-purple-500',
    lineColor: 'text-purple-400',
  },
  comment_added: {
    icon: <MessageSquare size={14} />,
    dotColor: 'bg-gray-500',
    lineColor: 'text-gray-400',
  },
  network_diagnostic: {
    icon: <Network size={14} />,
    dotColor: 'bg-cyan-500',
    lineColor: 'text-cyan-400',
  },
  audit_log: {
    icon: <Activity size={14} />,
    dotColor: 'bg-gray-600',
    lineColor: 'text-gray-500',
  },
};

const formatTime = (timestamp: string): string => {
  try {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 60) return `há ${diff} segundos`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} horas`;
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch {
    return '';
  }
};

const SkeletonEvent: React.FC = () => (
  <div className="flex gap-4 animate-pulse">
    <div className="flex flex-col items-center">
      <div className="w-3 h-3 rounded-full bg-gray-700 mt-1" />
      <div className="w-0.5 h-12 bg-gray-800 mt-1" />
    </div>
    <div className="flex-1 pb-4">
      <div className="h-3 bg-gray-700 rounded w-40 mb-2" />
      <div className="h-2 bg-gray-800 rounded w-64" />
    </div>
  </div>
);

const IncidentTimeline: React.FC<Props> = ({ alertId, ticketId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = useCallback(async () => {
    if (!alertId && !ticketId) return;
    setLoading(true);
    setError('');
    try {
      const res = await timelineApi.getTimeline({ alertId, ticketId });
      setEvents(res.data.timeline || []);
    } catch {
      setError('Erro ao carregar timeline');
    } finally {
      setLoading(false);
    }
  }, [alertId, ticketId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (!alertId && !ticketId) return null;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <Clock size={16} className="text-emerald-400" />
        <h3 className="text-white font-semibold text-sm">Timeline do Incidente</h3>
        {events.length > 0 && (
          <span className="text-gray-600 text-xs">{events.length} eventos</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <SkeletonEvent key={i} />)}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-400 text-sm py-4">
          <AlertTriangle size={14} />
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock size={32} className="text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">Nenhum evento encontrado na timeline</p>
        </div>
      ) : (
        <div className="relative">
          {events.map((event, idx) => {
            const config = typeConfig[event.type] || typeConfig.audit_log;
            const isLast = idx === events.length - 1;

            return (
              <div key={event.id} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 flex items-center justify-center ${config.dotColor}`}>
                    <span className="text-white">{React.cloneElement(config.icon as React.ReactElement, { size: 8 })}</span>
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-gray-700 mt-1 mb-1 min-h-[20px]" />}
                </div>

                {/* Event content */}
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${config.lineColor}`}>{event.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{event.description}</p>
                      {event.user && (
                        <p className="text-gray-600 text-xs mt-1">por {event.user}</p>
                      )}
                    </div>
                    <span className="text-gray-600 text-xs flex-shrink-0 mt-0.5 whitespace-nowrap">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
