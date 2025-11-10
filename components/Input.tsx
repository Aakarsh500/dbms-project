
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  return (
    <div className="space-y-2">
  <label htmlFor={id} className="block text-sm font-semibold tracking-wide text-slate-600">
        {label}
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
        </span>
        <input
          id={id}
          className="block w-full rounded-xl border border-slate-200 bg-white px-9 py-3 text-sm font-medium text-slate-700 placeholder-slate-400 shadow-[0_14px_30px_-20px_rgba(14,116,144,0.35)] focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:ring-offset-1 focus:ring-offset-white transition-all"
          {...props}
        />
      </div>
    </div>
  );
};

export default Input;
