// Backwards-compatible shim. The real implementation is a shared context now, so
// every caller sees the same user and reacts to login / logout without a reload.
export { useAuth } from "../context/AuthProvider";
export type { AuthUser, Role } from "../context/AuthProvider";
