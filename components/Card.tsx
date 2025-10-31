
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const baseClasses =
    'bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all duration-300';
  const clickableClasses = onClick
    ? 'cursor-pointer hover:shadow-xl hover:transform hover:-translate-y-1'
    : '';

  return (
    <div
      className={`${baseClasses} ${clickableClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
