/**
 * Console session.
 *
 * The token is held in memory and mirrored to sessionStorage, not
 * localStorage: a registrar's console session should not outlive the browser
 * tab on a shared office machine. Losing it on a refresh would be hostile, so
 * sessionStorage is the middle ground.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from '@civiledger/ui';

const STORAGE_KEY = 'civiledger.console.session';

export interface ConsoleUser {
  id: string;
  role: string;
  displayName: string;
  organization: { id: string; slug: string; name: string; status: string } | null;
}

interface SessionValue {
  token: string | undefined;
  user: ConsoleUser | undefined;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** True until the stored token has been checked against the API. */
  restoring: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStored(): string | undefined {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function SessionProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(readStored);
  const [user, setUser] = useState<ConsoleUser | undefined>();
  const [restoring, setRestoring] = useState(Boolean(readStored()));

  const clear = useCallback(() => {
    setToken(undefined);
    setUser(undefined);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage was unavailable in the first place.
    }
  }, []);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        token: () => token,
        onUnauthorized: clear,
      }),
    [baseUrl, token, clear],
  );

  // Re-read the account on every restore. The API re-reads it on every request
  // too, so a suspension takes effect immediately rather than at token expiry.
  useEffect(() => {
    if (!token) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    api
      .get<ConsoleUser>('/v1/auth/me')
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) clear();
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, token, clear]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const anonymous = createApiClient({ baseUrl });
      const result = await anonymous.post<{ token: string; user: ConsoleUser }>('/v1/auth/login', {
        email,
        password,
      });
      try {
        sessionStorage.setItem(STORAGE_KEY, result.token);
      } catch {
        // The session simply will not survive a refresh.
      }
      setToken(result.token);
      setUser(result.user);
    },
    [baseUrl],
  );

  const signOut = useCallback(() => {
    void api.post('/v1/auth/logout').catch(() => undefined);
    clear();
  }, [api, clear]);

  const value = useMemo<SessionValue>(
    () => ({ token, user, api, signIn, signOut, restoring }),
    [token, user, api, signIn, signOut, restoring],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}

/** Capabilities, mirroring the API. The server is still the authority. */
const CAPABILITIES: Record<string, readonly string[]> = {
  REGISTRAR: ['import:create', 'import:read', 'credential:read', 'analytics:read'],
  EXAM_CONTROLLER: [
    'import:create',
    'import:read',
    'batch:approve',
    'credential:read',
    'credential:revoke',
    'analytics:read',
  ],
  ORG_ADMIN: [
    'import:read',
    'batch:approve',
    'credential:read',
    'credential:revoke',
    'analytics:read',
    'org:manage',
  ],
  VERIFIER_STAFF: [],
  OVERSIGHT: [],
  PLATFORM_ADMIN: [],
};

/**
 * Hide what the user cannot do. This is courtesy, not security: every one of
 * these is enforced server-side, and the UI never becomes the check.
 */
export function useCan(): (capability: string) => boolean {
  const { user } = useSession();
  return useCallback(
    (capability: string) => (user ? (CAPABILITIES[user.role] ?? []).includes(capability) : false),
    [user],
  );
}
