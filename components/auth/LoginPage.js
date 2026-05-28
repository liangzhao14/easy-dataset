'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import {
  Box, Card, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, alpha
} from '@mui/material';
import {
  Visibility, VisibilityOff, Person, Lock, Login as LoginIcon,
  DatasetLinked as LogoIcon, DarkMode, LightMode
} from '@mui/icons-material';
import { tokenAtom, currentUserAtom, loginAction } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setToken = useSetAtom(tokenAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginAction(username, password);
      setToken(data.token);
      setCurrentUser(data.user);
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 30%, #24243e 60%, #0f0c29 100%)'
      }}
    >
      {/* Animated background blobs */}
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '-20%', left: '-10%',
            width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15), transparent 70%)',
            filter: 'blur(60px)'
          }}
        />
        <motion.div
          animate={{ x: [0, -80, 0], y: [0, 80, 0], scale: [1.1, 0.9, 1.1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: '-30%', right: '-10%',
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent 70%)',
            filter: 'blur(60px)'
          }}
        />
        <motion.div
          animate={{ x: [0, 60, -60, 0], y: [0, -30, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '40%', left: '50%',
            width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent 70%)',
            filter: 'blur(50px)'
          }}
        />
      </Box>

      {/* Main content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key="login-form"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <Card
              elevation={0}
              sx={{
                backdropFilter: 'blur(24px)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
              }}
            >
              {/* Card top accent bar */}
              <Box
                sx={{
                  height: 3,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)'
                }}
              />

              <Box sx={{ p: { xs: 4, sm: 5 } }}>
                {/* Logo */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}
                >
                  <Box
                    sx={{
                      width: 64, height: 64,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    <LogoIcon sx={{ fontSize: 36, color: '#fff' }} />
                  </Box>
                </motion.div>

                {/* Title */}
                <Typography
                  variant="h4"
                  align="center"
                  sx={{
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #e2e8f0 0%, #a5b4fc 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1
                  }}
                >
                  Easy Dataset
                </Typography>

                <Typography
                  variant="body2"
                  align="center"
                  sx={{ color: 'rgba(255,255,255,0.45)', mb: 4, fontSize: '0.9rem' }}
                >
                  团队协作数据集生产平台
                </Typography>

                {/* Divider */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                    '&::before, &::after': {
                      content: '""',
                      flex: 1,
                      height: '1px',
                      background: 'rgba(255,255,255,0.08)'
                    }
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                    登录
                  </Typography>
                </Box>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Alert
                        severity="error"
                        variant="filled"
                        sx={{
                          mb: 2.5,
                          borderRadius: 2,
                          '& .MuiAlert-message': { fontSize: '0.875rem' }
                        }}
                      >
                        {error}
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <Box component="form" onSubmit={handleLogin}>
                  <TextField
                    fullWidth
                    placeholder="请输入账号"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }} />
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        color: '#e2e8f0',
                        borderRadius: 2,
                        background: 'rgba(255, 255, 255, 0.04)',
                        transition: 'all 0.2s',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: 2 },
                        '& input::placeholder': { color: 'rgba(255,255,255,0.3)' }
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' }
                    }}
                  />

                  <TextField
                    fullWidth
                    placeholder="请输入密码"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setShowPassword(!showPassword)}
                            sx={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        color: '#e2e8f0',
                        borderRadius: 2,
                        background: 'rgba(255, 255, 255, 0.04)',
                        transition: 'all 0.2s',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: 2 },
                        '& input::placeholder': { color: 'rgba(255,255,255,0.3)' }
                      }
                    }}
                  />

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={loading || !username || !password}
                      startIcon={!loading && <LoginIcon />}
                      sx={{
                        py: 1.6,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        background: loading
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
                        '&:hover': {
                          boxShadow: '0 6px 28px rgba(99, 102, 241, 0.5)',
                          background: 'linear-gradient(135deg, #7372f5, #9b6df5)'
                        },
                        '&:disabled': {
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.2)'
                        }
                      }}
                    >
                      {loading ? (
                        <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      ) : (
                        '登录'
                      )}
                    </Button>
                  </motion.div>
                </Box>

                {/* Footer */}
                <Typography
                  variant="caption"
                  align="center"
                  display="block"
                  sx={{ mt: 4, color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}
                >
                  首次使用？请先初始化管理员账号
                </Typography>
              </Box>
            </Card>

            {/* Bottom text */}
            <Typography
              variant="caption"
              align="center"
              display="block"
              sx={{ mt: 3, color: 'rgba(255,255,255,0.15)', fontSize: '0.7rem' }}
            >
              Easy Dataset v1.7.3 · Powered by Next.js
            </Typography>
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
