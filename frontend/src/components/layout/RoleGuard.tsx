import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { ReactNode } from "react";

export function RoleGuard({ allow, children }: { allow: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
