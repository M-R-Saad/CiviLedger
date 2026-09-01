import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, type Role } from "../../context/AuthProvider";

const ROLE_HOME: Record<Role, string> = {
  CITIZEN: "/citizen",
  ISSUER_ADMIN: "/issuer",
  VERIFIER_STAFF: "/verifier",
  OVERSIGHT: "/oversight",
};

/** Layout route: gate everything below it on an authenticated session. */
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}

/** Per-route role gate. Wrong role goes to that user's own home, not a dead end. */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return <>{children}</>;
}

export { ROLE_HOME };
