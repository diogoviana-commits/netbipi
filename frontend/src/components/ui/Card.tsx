import React from 'react';

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ title, action, children, className = '', padding = true }) => {
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          {title && <h3 className="text-white font-semibold text-sm">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  );
};

export default Card;
