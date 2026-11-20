/**
 * Wallet session.
 *
 * localStorage here, unlike the console: this is the graduate's own phone, a
 * wallet that logs you out every time you close the tab is not a wallet, and
 * the token still expires server-side.
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

const STORAGE_KEY = 'civiledger.wallet.session';

export interface WalletHolder {
  id: string;
  displayName: string;
}

interface SessionValue {
  token: string | undefined;
  holder: WalletHolder | undefined;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** True until the stored token has been checked against the API. */
  restoring: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStored(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function SessionProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(readStored);
  const [holder, setHolder] = useState<WalletHolder | undefined>();
  const [restoring, setRestoring] = useState(Boolean(readStored()));

  const clear = useCallback(() => {
    setToken(undefined);
    setHolder(undefined);
    try {
      localStorage.removeItem(STORAGE_KEY);
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
    // The wallet has no /me endpoint of its own; a cheap authenticated read
    // confirms the token is still good and the account still exists.
    api
      .get<{ credentials: unknown[] }>('/v1/wallet/credentials')
      .then(() => {
        if (!cancelled) setHolder((current) => current ?? { id: 'self', displayName: '' });
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
      const result = await anonymous.post<{ token: string; holder: WalletHolder }>(
        '/v1/auth/wallet/login',
        { email, password },
      );
      try {
        localStorage.setItem(STORAGE_KEY, result.token);
      } catch {
        // The session simply will not survive a refresh.
      }
      setToken(result.token);
      setHolder(result.holder);
    },
    [baseUrl],
  );

  const signOut = useCallback(() => {
    void api.post('/v1/auth/logout').catch(() => undefined);
    clear();
  }, [api, clear]);

  const value = useMemo<SessionValue>(
    () => ({ token, holder, api, signIn, signOut, restoring }),
    [token, holder, api, signIn, signOut, restoring],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
