/**
 * A small typed fetch client.
 *
 * Deliberately not a data-fetching library: three surfaces with a handful of
 * endpoints each do not need a cache invalidation model, and the previous
 * system's failure mode was half its pages bypassing the shared hook anyway.
 */

import { useCallback, useState } from 'react';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    /** Stable machine code from the API. Translate it; never show it raw. */
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  /** Raw text, for the status list endpoint. */
  text(path: string): Promise<string>;
}

export interface ApiOptions {
  baseUrl: string;
  /** Returns the current bearer token, or undefined for public calls. */
  token?: () => string | undefined;
  /** Called on a 401 so the surface can clear its session. */
  onUnauthorized?: () => void;
}

export function createApiClient(options: ApiOptions): ApiClient {
  const base = options.baseUrl.replace(/\/$/, '');

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = options.token?.();
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 401 && !path.startsWith('/v1/auth/')) {
      options.onUnauthorized?.();
    }

    if (!response.ok) {
      let code = 'REQUEST_FAILED';
      let message = response.statusText;
      let details: unknown;
      try {
        const body = (await response.json()) as {
          error?: string;
          message?: string;
          details?: unknown;
        };
        code = body.error ?? code;
        message = body.message ?? message;
        details = body.details;
      } catch {
        // A non-JSON error body. The status code is all we have.
      }
      throw new ApiError(response.status, code, message, details);
    }

    return response;
  }

  return {
    async get<T>(path: string) {
      return (await request(path)).json() as Promise<T>;
    },
    async post<T>(path: string, body?: unknown) {
      const response = await request(path, {
        method: 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
    async del<T>(path: string) {
      const response = await request(path, { method: 'DELETE' });
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
    async text(path: string) {
      return (await request(path)).text();
    },
  };
}

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  run: (...args: never[]) => Promise<T | undefined>;
  reset: () => void;
}

/** Loading, error and data for a one-shot call. */
export function useApi<T, A extends unknown[] = []>(
  fn: (...args: A) => Promise<T>,
): {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  run: (...args: A) => Promise<T | undefined>;
  reset: () => void;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (...args: A) => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await fn(...args);
        setData(result);
        return result;
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError(0, 'NETWORK_ERROR', caught instanceof Error ? caught.message : 'failed'),
        );
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(undefined);
    setLoading(false);
  }, []);

  return { data, error, loading, run, reset };
}
