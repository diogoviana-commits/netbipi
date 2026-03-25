import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  Ticket,
  Server,
  ScrollText,
  Network,
  LogOut,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Map,
  Cloud,
  BarChart2,
  Monitor,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { alertsApi } from '../../services/api';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  external?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await alertsApi.getAlertStats();
        setOpenAlertsCount(res.data.totalOpen || 0);
      } catch {
        // ignore
      }
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const mainItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/alerts', label: 'Alertas', icon: <Bell size={18} />, badge: openAlertsCount > 0 ? openAlertsCount : undefined },
    { path: '/tickets', label: 'Chamados', icon: <Ticket size={18} /> },
    { path: '/assets', label: 'Ativos', icon: <Server size={18} /> },
    { path: '/logs', label: 'Logs', icon: <ScrollText size={18} /> },
    { path: '/network', label: 'Rede', icon: <Network size={18} /> },
  ];

  const navGroups: NavGroup[] = [
    {
      label: 'Operações',
      items: [
        { path: '/shift', label: 'Turno Atual', icon: <Clock size={18} /> },
      ],
    },
    {
      label: 'Recursos',
      items: [
        { path: '/knowledge', label: 'Base de Conhecimento', icon: <BookOpen size={18} /> },
        { path: '/map', label: 'Mapa de Infra', icon: <Map size={18} /> },
        { path: '/cloud', label: 'Painel Cloud', icon: <Cloud size={18} /> },
        { path: '/reports', label: 'Relatórios', icon: <BarChart2 size={18} /> },
      ],
    },
    {
      label: 'Exibição',
      items: [
        { path: '/kiosk', label: 'Modo Quiosque NOC', icon: <Monitor size={18} />, external: true },
      ],
    },
  ];

  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'n2' ? 'Analista N2' : 'Analista N1';
  const roleColor = user?.role === 'admin' ? 'text-purple-400' : user?.role === 'n2' ? 'text-blue-400' : 'text-emerald-400';

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    if (item.external) {
      return (
        <a
          key={item.path}
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative text-gray-400 hover:text-gray-200 hover:bg-gray-800 ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!collapsed && <span className="flex-1">{item.label}</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-gray-700">
              {item.label}
            </div>
          )}
        </a>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
          isActive
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && (
              <span className="bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge !== undefined && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" />
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-gray-700">
            {item.label}
            {item.badge ? ` (${item.badge})` : ''}
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={`relative flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } min-h-screen`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-white font-bold text-base leading-none">NetBIPI</h1>
            <p className="text-gray-500 text-xs mt-0.5">Hub Operacional</p>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {/* Main items */}
        {mainItems.map(renderNavItem)}

        {/* Grouped items */}
        {navGroups.map((group) => (
          <div key={group.label} className="pt-3">
            {!collapsed && (
              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 pb-1.5">
                {group.label}
              </p>
            )}
            {collapsed && <div className="border-t border-gray-800 my-2" />}
            <div className="space-y-1">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className={`border-t border-gray-800 p-3 ${collapsed ? 'items-center' : ''}`}>
        {!collapsed && (
          <div className="px-2 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{user?.fullName || user?.username}</p>
            <p className={`text-xs font-medium ${roleColor}`}>{roleLabel}</p>
            <p className="text-gray-500 text-xs truncate">{user?.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg text-sm transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
