import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import { useT } from "../i18n/I18nProvider";
import { IconCheck, IconDash, IconX } from "../components/ui/icons";

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

// Same visual language as the Alert component.
const TONE: Record<ToastType, string> = {
  success: "border-ok-border bg-ok-bg text-ok-fg",
  error: "border-danger-border bg-danger-bg text-danger-fg",
  warning: "border-warn-border bg-warn-bg text-warn-fg",
  info: "border-accent-border bg-accent-quiet text-ink",
};

const ICON: Record<ToastType, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  success: IconCheck,
  error: IconX,
  warning: IconDash,
  info: IconDash,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICON[toast.type];
          return (
            <div
              key={toast.id}
              className={`toast-item pointer-events-auto flex items-start gap-2.5 rounded-container border px-4 py-3 text-sm shadow-overlay ${TONE[toast.type]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 leading-6">{toast.message}</span>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] opacity-60 transition-opacity hover:opacity-100"
                aria-label={t("action.dismiss")}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .toast-item { animation: toast-in 0.18s cubic-bezier(0.2, 0, 0, 1); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
