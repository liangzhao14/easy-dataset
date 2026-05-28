'use client';

import { useEffect } from 'react';
import { useSetAtom, useAtomValue, useAtom } from 'jotai';
import { tokenAtom, currentUserAtom, authLoadingAtom, authCheckedAtom, fetchCurrentUser } from './auth-context';

export default function AuthProvider({ children }) {
  const setCurrentUser = useSetAtom(currentUserAtom);
  const setAuthLoading = useSetAtom(authLoadingAtom);
  const setAuthChecked = useSetAtom(authCheckedAtom);
  const [token, setToken] = useAtom(tokenAtom);

  // 客户端挂载时从 localStorage 恢复 token（SSR 期间不可用）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('easy-dataset-token');
    if (stored && !token) {
      setToken(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // token 就绪后验证
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!token) {
        if (!cancelled) {
          setAuthLoading(false);
          setAuthChecked(true);
        }
        return;
      }

      try {
        const user = await fetchCurrentUser(token);
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled && typeof window !== 'undefined') {
          localStorage.removeItem('easy-dataset-token');
          setToken(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          setAuthChecked(true);
        }
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, [token, setCurrentUser, setAuthLoading, setAuthChecked, setToken]);

  return children;
}
