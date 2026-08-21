import React from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      icon: <AlertTriangle className="h-6 w-6 text-rose-500" />,
      btn: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      icon: <AlertCircle className="h-6 w-6 text-amber-500" />,
      btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    info: {
      bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      icon: <Info className="h-6 w-6 text-cyan-500" />,
      btn: 'bg-cyan-500 hover:bg-cyan-400 text-black',
    },
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-550" />,
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
  };

  const styles = typeStyles[type];

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error('Error during confirmation callback:', err);
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div 
        className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start space-x-3.5">
          <div className={`p-2.5 rounded-xl border ${styles.bg}`}>
            {styles.icon}
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="text-lg font-bold text-white leading-6">{title}</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-750"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors shadow-md ${styles.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
