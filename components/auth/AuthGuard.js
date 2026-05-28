'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { isLoggedInAtom, authLoadingAtom, authCheckedAtom, tokenAtom, currentUserAtom } from '@/lib/auth-context';
import { Box, CircularProgress } from '@mui/material';

/**
 * AuthGuard: 包裹需要登录的页面
 * 在认证检查完成前显示 loading，避免 SSR/CSR 水合期间误跳转
 */
export default function AuthGuard({ children, requireAdmin = false }) {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const authLoading = useAtomValue(authLoadingAtom);
  const authChecked = useAtomValue(authCheckedAtom);
  const token = useAtomValue(tokenAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    // 认证检查中不跳转
    if (authLoading || !authChecked) return;

    // 已登录 + 不需要 admin → OK
    if (isLoggedIn) {
      if (requireAdmin && currentUser?.role !== 'admin') {
        router.replace('/');
      }
      return;
    }

    // 未登录 → 跳转
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    fetch('/api/auth/init')
      .then(res => res.json())
      .then(data => {
        router.replace(data.needsInit ? '/init' : '/login');
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [authLoading, authChecked, isLoggedIn, currentUser, router, requireAdmin]);

  // 认证中 → 显示 loading
  if (authLoading || !authChecked) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  // 未登录 → null（等待 useEffect 跳转）
  if (!isLoggedIn) return null;
  if (requireAdmin && currentUser?.role !== 'admin') return null;

  return children;
}
