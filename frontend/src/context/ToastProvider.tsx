import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" style={{ pointerEvents: "none" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item flex items-start gap-3 rounded-container border px-4 py-3 shadow-overlay text-sm ${TOAST_STYLES[toast.type]}`}
            style={{ pointerEvents: "auto", animation: "toast-slide-in 0.3s ease-out" }}
          >
            <span className="text-base shrink-0">{TOAST_ICON[toast.type]}</span>
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-xs opacity-50 hover:opacity-100 shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-ok-bg border-ok-border text-ok-fg",
  error: "bg-danger-bg border-danger-border text-danger-fg",
  warning: "bg-warn-bg border-warn-border text-warn-fg",
  info: "bg-accent-quiet border-accent-border text-accent",
};

const TOAST_ICON: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
