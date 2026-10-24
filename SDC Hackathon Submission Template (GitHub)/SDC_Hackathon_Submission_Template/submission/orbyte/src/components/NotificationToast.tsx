import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
              isError
                ? 'bg-[#FDF2F2] border-2 border-[#B33927] text-[#991B1B] shadow-[4px_4px_0_#B33927]'
                : isWarning
                ? 'bg-[#FFFDF8] border-2 border-[#1C3F35] text-[#1C3F35] shadow-[4px_4px_0_#E5A842]'
                : 'bg-[#FFFFFF] border-2 border-[#1C3F35] text-[#1C3F35] shadow-[4px_4px_0_#1C3F35]'
            }`}
          >
            <div className="flex items-start gap-3">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-[#285443] shrink-0 mt-0.5" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-[#E5A842] shrink-0 mt-0.5" />}
              {isError && <XCircle className="w-5 h-5 text-[#B33927] shrink-0 mt-0.5" />}
              {!isSuccess && !isWarning && !isError && <Info className="w-5 h-5 text-[#285443] shrink-0 mt-0.5" />}

              <div className="flex-1 text-xs">
                <div className="font-serif font-bold text-sm leading-tight mb-1">{toast.title}</div>
                <div className="text-[#4A635B] leading-relaxed font-sans">{toast.message}</div>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity p-1 -mr-1 -mt-1 text-inherit cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
