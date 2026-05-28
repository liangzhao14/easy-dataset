'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress
} from '@mui/material';

export default function InitPage() {
  const [username, setUsername] = useState('admin');
  const [displayName, setDisplayName] = useState('管理员');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsInit, setNeedsInit] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/init')
      .then(res => res.json())
      .then(data => {
        if (!data.needsInit) {
          router.push('/login');
        } else {
          setNeedsInit(true);
        }
      })
      .catch(() => setError('无法连接服务器'))
      .finally(() => setChecking(false));
  }, [router]);

  const handleInit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入密码不一致');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!needsInit) return null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      <Card sx={{ width: 400, maxWidth: '90vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 700 }}>
            初始化管理员账号
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            首次使用，请设置管理员账号和密码
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleInit}>
            <TextField fullWidth label="账号" value={username}
              onChange={e => setUsername(e.target.value)} margin="normal" disabled={loading} />
            <TextField fullWidth label="显示名称" value={displayName}
              onChange={e => setDisplayName(e.target.value)} margin="normal" disabled={loading} />
            <TextField fullWidth label="密码" type="password" value={password}
              onChange={e => setPassword(e.target.value)} margin="normal" disabled={loading} />
            <TextField fullWidth label="确认密码" type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} margin="normal" disabled={loading} />
            <Button type="submit" fullWidth variant="contained" size="large"
              disabled={loading || !username || !password || !confirmPassword}
              sx={{ mt: 2, py: 1.5 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : '初始化'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
