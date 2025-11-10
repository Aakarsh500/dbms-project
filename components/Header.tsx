
import React from 'react';
import { BookOpenIcon } from './icons';

interface HeaderProps {
  userRole?: 'student' | 'admin';
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userRole, onLogout }) => {
  return (
    <header className="relative z-20 border-b border-slate-200 bg-white/95 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.25)] backdrop-blur">
      <div className="container relative mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
            <BookOpenIcon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">VIT Academics</h1>
            <p className="text-sm text-slate-500">Unified portal for attendance, academics, and insights.</p>
          </div>
        </div>
        {userRole && onLogout && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              {userRole} mode
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900/90 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_20px_-12px_rgba(15,23,42,0.35)] transition-all hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
