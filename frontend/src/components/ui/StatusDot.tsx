import React from 'react';

type StatusType = 'online' | 'offline' | 'warning' | 'unknown';

interface StatusDotProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<StatusType, { dot: string; pulse: string }> = {
  online: {
    dot: 'bg-emerald-500',
    pulse: 'animate-ping bg-emerald-400 opacity-75',
  },
  offline: {
    dot: 'bg-red-500',
    pulse: '',
  },
  warning: {
    dot: 'bg-yellow-500',
    pulse: 'animate-ping bg-yellow-400 opacity-75',
  },
  unknown: {
    dot: 'bg-gray-500',
    pulse: '',
  },
};

const StatusDot: React.FC<StatusDotProps> = ({ status, label, size = 'sm' }) => {
  const styles = STATUS_STYLES[status];
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex">
        <span className={`${dotSize} rounded-full ${styles.dot}`} />
        {styles.pulse && (
          <span className={`absolute inline-flex ${dotSize} rounded-full ${styles.pulse}`} />
        )}
      </span>
      {label && <span className="text-xs text-gray-400">{label}</span>}
    </span>
  );
};

export default StatusDot;
