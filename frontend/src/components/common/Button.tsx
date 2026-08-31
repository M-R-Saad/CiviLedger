import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
