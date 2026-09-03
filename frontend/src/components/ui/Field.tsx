import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Field owns the <label>, the hint, the error, and wires aria-describedby /
 * aria-invalid onto its single control child. Use with Input / Select / Textarea.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-fg" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

const controlBase =
  "w-full rounded-control border bg-surface px-3 text-base text-ink transition-colors duration-150 placeholder:text-ink-subtle focus-visible:border-accent disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle";

const isInvalid = (v: unknown) => v === true || v === "true";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...rest }, ref) => (
    <input
      ref={ref}
      className={`${controlBase} h-10 ${
        isInvalid(rest["aria-invalid"]) ? "border-danger-border" : "border-line-strong"
      } ${className}`}
      {...rest}
    />
  )
);
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", children, ...rest }, ref) => (
  <select
    ref={ref}
    className={`${controlBase} h-10 ${
      isInvalid(rest["aria-invalid"]) ? "border-danger-border" : "border-line-strong"
    } ${className}`}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...rest }, ref) => (
  <textarea
    ref={ref}
    className={`${controlBase} min-h-[5rem] resize-y py-2 leading-6 ${
      isInvalid(rest["aria-invalid"]) ? "border-danger-border" : "border-line-strong"
    } ${className}`}
    {...rest}
  />
));
Textarea.displayName = "Textarea";
