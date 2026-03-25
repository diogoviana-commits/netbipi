import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationPanel from '../NotificationPanel';
import { useSocket } from '../../hooks/useSocket';

const PAGE_LABELS: Record<string, string[]> = {
  '/': ['Dashboard'],
  '/alerts': ['Alertas'],
  '/tickets': ['Chamados'],
  '/assets': ['Ativos', 'Inventário'],
  '/logs': ['Logs', 'Monitoramento'],
  '/network': ['Rede', 'Diagnósticos'],
  '/knowledge': ['Base de Conhecimento'],
  '/reports': ['Relatórios'],
  '/cloud': ['Painel Cloud'],
  '/shift': ['Turno Atual'],
  '/map': ['Mapa de Infraestrutura'],
};

const Header: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initialize socket connection
  useSocket();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const breadcrumbs = PAGE_LABELS[location.pathname] || ['NetBIPI'];

  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'n2' ? 'N2' : 'N1';
  const roleBg = user?.role === 'admin' ? 'bg-purple-600/20 text-purple-400 border-purple-600/30' :
    user?.role === 'n2' ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' :
    'bg-emerald-600/20 text-emerald-400 border-emerald-600/30';

  const timeStr = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm">NetBIPI</span>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={14} className="text-gray-600" />
            <span className={`text-sm ${index === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-gray-400'}`}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="text-right hidden sm:block">
          <p className="text-white text-sm font-mono font-medium">{timeStr}</p>
          <p className="text-gray-500 text-xs capitalize">{dateStr}</p>
        </div>

        {/* Notification Panel */}
        <NotificationPanel />

        {/* Role badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded border ${roleBg}`}>
          {roleLabel}
        </span>
      </div>
    </header>
  );
};

export default Header;
