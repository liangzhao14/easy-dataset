'use client';

import { useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSetAtom, useAtom } from 'jotai';
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
  const initializedRef = useRef(false);

  // 初始化（仅一次）：装拦截器 + 确定登录态。
  // 优先 localStorage token；无则尝试用 httpOnly 会话 Cookie 引导
  // （4A SSO 登录后 token 在 Cookie 里，借 /api/auth/me 换进 localStorage —— §13.3 token 交接缝）。
  // 必须在「判定未登录」之前完成引导，否则会把已登录(有 Cookie)用户误弹去登录页。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    installGlobalInterceptors();
    let cancelled = false;

    (async () => {
      try {
        let activeToken = localStorage.getItem('easy-dataset-token');

        if (!activeToken) {
          try {
            const res = await fetch('/api/auth/me'); // 不带 Bearer，靠会话 Cookie
            if (res.ok) {
              const data = await res.json();
              if (data?.token) activeToken = data.token;
            }
          } catch {
            /* 无会话，视为未登录 */
          }
        }

        if (!activeToken) return; // 未登录

        const user = await fetchCurrentUser(activeToken);
        if (cancelled) return;
        setCurrentUser(user);
        setToken(activeToken); // 写 localStorage + atom，后续走 Bearer
      } catch {
        if (!cancelled) {
          localStorage.removeItem('easy-dataset-token');
          setToken(null);
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          initializedRef.current = true;
          setAuthLoading(false);
          setAuthChecked(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 初始化之后 token 变化（登录表单成功 / 登出 / 失效）→ 同步用户态
  useEffect(() => {
    if (!initializedRef.current) return; // 初始化阶段由上面的 effect 负责
    let cancelled = false;

    (async () => {
      if (!token) {
        if (!cancelled) setCurrentUser(null);
        return;
      }
      try {
        const user = await fetchCurrentUser(token);
        if (!cancelled) setCurrentUser(user);
      } catch {
        if (!cancelled && typeof window !== 'undefined') {
          localStorage.removeItem('easy-dataset-token');
          setToken(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [token, setCurrentUser, setToken]);

  return children;
}
