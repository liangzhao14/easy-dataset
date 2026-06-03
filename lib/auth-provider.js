'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSetAtom, useAtomValue, useAtom } from 'jotai';
import { tokenAtom, currentUserAtom, authLoadingAtom, authCheckedAtom, fetchCurrentUser } from './auth-context';

// 全局拦截器只挂载一次
let interceptorsInstalled = false;

function installGlobalInterceptors() {
  if (interceptorsInstalled || typeof window === 'undefined') return;
  interceptorsInstalled = true;

  // 1) axios 请求拦截器：所有 /api/* 请求自动带 Authorization
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('easy-dataset-token');
    if (token && config.url && config.url.startsWith('/api/')) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  // 2) axios 响应拦截器：401 时清理 token 跳登录
  axios.interceptors.response.use(
    (resp) => resp,
    (err) => {
      if (err?.response?.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('easy-dataset-token');
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/init')) {
          window.location.href = '/login';
        }
      } else if (err?.response?.status === 403) {
        toast.error(err.response.data?.error || '无权限执行此操作');
      }
      return Promise.reject(err);
    }
  );

  // 3) 包装全局 fetch：仅对 /api/* 自动加 Authorization
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith('/api/')) {
      const token = localStorage.getItem('easy-dataset-token');
      if (token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }
    const resp = await originalFetch(input, init);
    // 401 → 清理 token 跳登录（仅对业务 API，不打扰登录页本身）
    if (resp.status === 401 && url.startsWith('/api/') && !url.includes('/api/auth/')) {
      localStorage.removeItem('easy-dataset-token');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/init')) {
        window.location.href = '/login';
      }
    }
    // 403 → 无权限：统一弹友好提示（用后端返回的角色文案）
    if (resp.status === 403 && url.startsWith('/api/') && !url.includes('/api/auth/')) {
      resp
        .clone()
        .json()
        .then(d => toast.error(d?.error || '无权限执行此操作'))
        .catch(() => toast.error('无权限执行此操作'));
    }
    return resp;
  };
}

export default function AuthProvider({ children }) {
  const setCurrentUser = useSetAtom(currentUserAtom);
  const setAuthLoading = useSetAtom(authLoadingAtom);
  const setAuthChecked = useSetAtom(authCheckedAtom);
  const [token, setToken] = useAtom(tokenAtom);

  // 客户端挂载时安装全局拦截器，并从 localStorage 恢复 token
  useEffect(() => {
    if (typeof window === 'undefined') return;
    installGlobalInterceptors();
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
