'use client';

import { atom } from 'jotai';

// Token: 读/写 localStorage，确保不通过 JSON 序列化
function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('easy-dataset-token');
}

function setStoredToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('easy-dataset-token', token);
  } else {
    localStorage.removeItem('easy-dataset-token');
  }
}

// Token atom（带自定义读写）
const baseTokenAtom = atom(getStoredToken());
export const tokenAtom = atom(
  (get) => get(baseTokenAtom),
  (get, set, newToken) => {
    setStoredToken(newToken);
    set(baseTokenAtom, newToken);
  }
);

export const currentUserAtom = atom(null);
export const authLoadingAtom = atom(true);
export const authCheckedAtom = atom(false);

// 派生: 是否已登录
export const isLoggedInAtom = atom((get) => !!get(tokenAtom) && !!get(currentUserAtom));

// 登录
export async function loginAction(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '登录失败');
  return data;
}

// 获取当前用户
export async function fetchCurrentUser(token) {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('获取用户信息失败');
  return res.json();
}
