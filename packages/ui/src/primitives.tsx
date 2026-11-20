/**
 * The shared component vocabulary. DESIGN.md §7.
 *
 * Every interactive primitive ships default, hover, focus-visible, active,
 * disabled and, where it applies, loading and error. Half a set is not a set.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// ---------------------------------------------------------------- Button

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | undefined;
  size?: 'sm' | 'md' | undefined;
  loading?: boolean | undefined;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`cl-btn cl-btn--${variant}${size === 'sm' ? ' cl-btn--sm' : ''} ${className}`}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && !loading ? <span aria-hidden="true">{icon}</span> : null}
      <span className="cl-btn__label">{children}</span>
      {loading ? (
        <span className="cl-btn__spinner">
          <span className="cl-spinner" />
        </span>
      ) : null}
    </button>
  );
}

// ----------------------------------------------------------------- Field

export interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  optionalLabel?: string | undefined;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => ReactNode;
}

/**
 * Owns the label, the hint, the error and the `aria-describedby` wiring, so no
 * screen a11y depends on a form being assembled correctly by hand.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  optionalLabel = 'optional',
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="cl-field">
      <label className="cl-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="cl-field__optional"> ({optionalLabel})</span> : null}
      </label>
      {hint ? (
        <span className="cl-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <span className="cl-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`cl-input ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`cl-select ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`cl-textarea ${props.className ?? ''}`} />;
}

export interface CheckboxProps {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}

export function Checkbox({ label, hint, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className="cl-checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="cl-checkbox__body">
        <span className="cl-checkbox__label">{label}</span>
        {hint ? <span className="cl-checkbox__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

// ----------------------------------------------------------------- Panel

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/** The only card. Panels never nest inside Panels (DESIGN.md §4). */
export function Panel({ title, description, action, flush, children, className = '' }: PanelProps) {
  return (
    <section className={`cl-panel ${className}`}>
      {title || action ? (
        <header className="cl-panel__header">
          <div>
            <h2 className="cl-panel__title">{title}</h2>
            {description ? <p className="cl-panel__description">{description}</p> : null}
          </div>
          {action ? (
            <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
              {action}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={`cl-panel__body${flush ? ' cl-panel__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------ StatusPill

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

/**
 * Renders a translated label and the role-mapped colour. It takes a `label`
 * rather than a status string precisely so a raw enum can never reach a user
 * (PRODUCT.md anti-reference).
 */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`cl-pill cl-pill--${tone}`}>{label}</span>;
}

// ----------------------------------------------------------------- Alert

export function Alert({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={`cl-alert cl-alert--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className="cl-alert__icon" aria-hidden="true">
        {variant === 'error' || variant === 'warning' ? '!' : variant === 'success' ? '✓' : 'i'}
      </span>
      <div className="cl-alert__body">
        {title ? <div className="cl-alert__title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Skeleton

export function Skeleton({
  width = '100%',
  height = 16,
}: {
  width?: string | number;
  height?: number;
}) {
  return (
    <span className="cl-skeleton" style={{ display: 'block', width, height }} aria-hidden="true" />
  );
}

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="cl-stack"
      style={{ gap: 'var(--space-3)', padding: 'var(--space-4)' }}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="cl-row" style={{ gap: 'var(--space-4)' }}>
          {Array.from({ length: columns }).map((_, column) => (
            <Skeleton
              key={column}
              width={column === 0 ? '28%' : `${Math.max(12, 60 / columns)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ EmptyState

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="cl-empty">
      <p className="cl-empty__title">{title}</p>
      {body ? <p className="cl-empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

// ------------------------------------------------------------ PageHeader

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <header className="cl-page-header">
      <div>
        <h1 className="cl-page-header__title">{title}</h1>
        {description ? <p className="cl-page-header__description">{description}</p> : null}
      </div>
      {actions ? (
        <div className="cl-row" style={{ gap: 'var(--space-2)' }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

// --------------------------------------------------------- CopyableValue

export function truncateMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Hashes, tokens and transaction ids. The full value is in `title` and read to
 * screen readers; the visible form is truncated in the middle so both ends stay
 * comparable by eye.
 */
export function CopyableValue({
  value,
  label,
  href,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
}: {
  value: string;
  label?: string | undefined;
  href?: string | undefined;
  copyLabel?: string | undefined;
  copiedLabel?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [value]);

  return (
    <span className="cl-copyable">
      <span title={value}>
        <span className="sr-only">{label ? `${label}: ${value}` : value}</span>
        <span aria-hidden="true">{truncateMiddle(value)}</span>
      </span>
      <button
        type="button"
        className="cl-copyable__btn"
        onClick={copy}
        aria-label={copied ? copiedLabel : `${copyLabel} ${label ?? ''}`.trim()}
      >
        {copied ? '✓' : '⧉'}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open in block explorer"
        >
          ↗
        </a>
      ) : null}
    </span>
  );
}

// ------------------------------------------------------------- Toast

interface ToastMessage {
  id: number;
  variant: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

const ToastContext = createContext<
  ((variant: ToastMessage['variant'], text: string) => void) | null
>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback((variant: ToastMessage['variant'], text: string) => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, variant, text }]);
    setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          insetBlockEnd: 'var(--space-6)',
          insetInlineEnd: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          zIndex: 50,
          maxWidth: 'min(420px, calc(100vw - 32px))',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{ boxShadow: 'var(--shadow-overlay)', borderRadius: 'var(--radius-control)' }}
          >
            <Alert variant={message.variant}>{message.text}</Alert>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside a ToastProvider');
  return push;
}
