
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  ...props
}) => {
  const baseClasses =
    'w-full flex justify-center items-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_14px_28px_-18px_rgba(14,116,144,0.45)]';

  const variantClasses = {
    primary:
      'text-white bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-500 hover:from-sky-600 hover:via-indigo-600 hover:to-blue-600 focus-visible:ring-sky-300',
    secondary:
      'text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200/80 focus-visible:ring-slate-200',
    danger:
      'text-white bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 focus-visible:ring-red-300',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
