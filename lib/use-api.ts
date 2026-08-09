import { useCallback } from 'react';
import { useAuth } from './auth-context';

export function useFetchWithAuth() {
  const { getToken, loading } = useAuth();
  
  return useCallback(async (url: string | URL | globalThis.Request, options?: RequestInit) => {
    if (loading) {
        throw new Error("Auth is still loading");
    }
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json", 
        ...options?.headers 
      }
    });
  }, [getToken, loading]);
}
