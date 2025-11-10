
import React, { Fragment } from 'react';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
      <div
        className="flex w-full max-w-2xl max-h-[calc(100vh-3rem)] transform flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_70px_-35px_rgba(14,116,144,0.28)] transition-all"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Portal action</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:text-slate-900"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6 pb-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
