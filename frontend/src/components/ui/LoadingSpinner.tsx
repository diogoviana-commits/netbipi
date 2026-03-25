import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_STYLES = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
  return (
    <div
      className={`
        ${SIZE_STYLES[size]}
        rounded-full
        border-emerald-600/30
        border-t-emerald-500
        animate-spin
        inline-block
      `}
    />
  );
};

export const FullPageLoader: React.FC<{ message?: string }> = ({ message = 'Carregando...' }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
    <LoadingSpinner size="lg" />
    <p className="text-sm">{message}</p>
  </div>
);

export default LoadingSpinner;
