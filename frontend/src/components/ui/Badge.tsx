import React from 'react';

type BadgeVariant = 'info' | 'warning' | 'danger' | 'success' | 'default' | 'purple' | 'orange';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  info: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  warning: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  danger: 'bg-red-600/20 text-red-400 border-red-600/30',
  success: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  default: 'bg-gray-700/50 text-gray-400 border-gray-600/30',
  purple: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  orange: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
};

export const severityVariant = (severity: string): BadgeVariant => {
  switch (severity) {
    case 'disaster': return 'danger';
    case 'high': return 'orange';
    case 'average': return 'warning';
    case 'warning': return 'info';
    case 'info': return 'default';
    default: return 'default';
  }
};

export const priorityVariant = (priority: string): BadgeVariant => {
  switch (priority) {
    case 'critical': return 'danger';
    case 'high': return 'orange';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'default';
  }
};

export const statusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'open': return 'danger';
    case 'in_progress': return 'warning';
    case 'resolved': return 'success';
    case 'closed': return 'default';
    case 'acknowledged': return 'info';
    default: return 'default';
  }
};

export const severityLabel = (severity: string): string => {
  const labels: Record<string, string> = {
    disaster: 'Desastre',
    high: 'Alto',
    average: 'Médio',
    warning: 'Aviso',
    info: 'Info',
  };
  return labels[severity] || severity;
};

export const priorityLabel = (priority: string): string => {
  const labels: Record<string, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
  };
  return labels[priority] || priority;
};

export const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    open: 'Aberto',
    in_progress: 'Em Andamento',
    resolved: 'Resolvido',
    closed: 'Fechado',
    acknowledged: 'Reconhecido',
  };
  return labels[status] || status;
};

const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, size = 'sm', className = '' }) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${VARIANT_STYLES[variant]} ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
