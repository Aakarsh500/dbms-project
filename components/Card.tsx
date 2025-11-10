
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const baseClasses =
    'bg-white border border-slate-200 rounded-2xl shadow-[0_18px_35px_-20px_rgba(15,23,42,0.35)] transition-all duration-300';
  const clickableClasses = onClick
    ? 'cursor-pointer hover:shadow-[0_30px_60px_-30px_rgba(99,102,241,0.6)] hover:-translate-y-1'
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
