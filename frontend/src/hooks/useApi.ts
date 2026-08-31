import { useState, useCallback } from "react";

/**
 * Small generic wrapper for loading/error state around any async API call,
 * so page components don't repeat the same three useState calls everywhere.
 *
 * Usage:
 *   const { run, loading, error, data } = useApi(citizenApi.listMyCredentials);
 *   useEffect(() => { run(); }, []);
 */
export function useApi<T = any>(apiFn: (...args: any[]) => Promise<{ data: T }>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: any[]) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFn(...args);
        setData(res.data);
        return res.data;
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFn]
  );

  return { run, data, loading, error };
}
