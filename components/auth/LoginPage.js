'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Checkbox, FormControlLabel
} from '@mui/material';
import {
  Visibility, VisibilityOff, PersonOutline, LockOutlined, Login as LoginIcon,
  DatasetLinked as LogoIcon
} from '@mui/icons-material';
import { tokenAtom, currentUserAtom, loginAction } from '@/lib/auth-context';
import { motion, useReducedMotion } from 'framer-motion';

// —— 设计令牌（浅色科技蓝，柔和近参考图）——
const C = {
  primary: '#6E89E9',
  primaryDeep: '#5573E0',
  btn: 'linear-gradient(135deg, #98ACF4 0%, #6E89E9 100%)',
  btnHover: 'linear-gradient(135deg, #8AA0F1 0%, #5E7BE6 100%)',
  heading: '#1B2440',
  body: '#5A6A8A',
  muted: '#8A98B5',
  field: '#F7F9FC',
  border: '#E3E9F2',
  leftBg: 'linear-gradient(135deg, #E9F0FF 0%, #F2F7FF 45%, #FBFCFF 100%)',
  grid: 'rgba(110,137,233,0.06)'
};

const REMEMBER_KEY = 'easy-dataset-remember-username';

// 居中主视觉：SVG 八边形光环 + 柔光 + 悬浮 logo（不做实心 3D，干净为先）
function HeroVisual({ reduceMotion }) {
  return (
    <Box sx={{ position: 'relative', width: 360, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        component="svg"
        viewBox="0 0 360 340"
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="edGlow" cx="50%" cy="58%" r="52%">
            <stop offset="0%" stopColor="rgba(110,137,233,0.30)" />
            <stop offset="100%" stopColor="rgba(110,137,233,0)" />
          </radialGradient>
        </defs>
        {/* 柔光 */}
        <ellipse cx="180" cy="190" rx="150" ry="135" fill="url(#edGlow)" />
        {/* 底座反光 */}
        <ellipse cx="180" cy="296" rx="104" ry="18" fill="rgba(110,137,233,0.16)" />
      </Box>

      {/* 悬浮 logo 徽章 */}
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', marginTop: -10 }}
      >
        <Box
          sx={{
            width: 150, height: 150, borderRadius: '32px',
            background: 'linear-gradient(160deg, #ffffff 0%, #E9F0FF 100%)',
            border: '1px solid rgba(255,255,255,0.95)',
            boxShadow: '0 30px 60px rgba(110,137,233,0.34), inset 0 1px 0 #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <LogoIcon sx={{ fontSize: 80, color: C.primary }} />
        </Box>
      </motion.div>
    </Box>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setToken = useSetAtom(tokenAtom);
  const setCurrentUser = useSetAtom(currentUserAtom);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // 4A 接入：判断展示「4A 登录」还是本地密码表单（?local=1 走超管后门）
  const [fourAEnabled, setFourAEnabled] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsLocalMode(params.get('local') === '1');
    setQueryError(params.get('error') || '');
    const savedName = localStorage.getItem(REMEMBER_KEY);
    if (savedName) {
      setUsername(savedName);
      setRemember(true);
    }
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(data => setFourAEnabled(!!data.fourAEnabled))
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  const showLocalForm = isLocalMode || !fourAEnabled;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginAction(username, password);
      if (remember) localStorage.setItem(REMEMBER_KEY, username);
      else localStorage.removeItem(REMEMBER_KEY);
      setToken(data.token);
      setCurrentUser(data.user);
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    mb: 2.25,
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      background: C.field,
      transition: 'border-color .15s, box-shadow .15s',
      '& fieldset': { borderColor: C.border },
      '&:hover fieldset': { borderColor: '#C7D2E8' },
      '&.Mui-focused': { background: '#fff', boxShadow: '0 0 0 4px rgba(110,137,233,0.12)' },
      '&.Mui-focused fieldset': { borderColor: C.primary, borderWidth: 1.5 }
    },
    '& input': { color: C.heading, py: 1.7 },
    '& input::placeholder': { color: C.muted, opacity: 1 }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>
      {/* ===== 左：品牌 / 科技插画区 ===== */}
      <Box
        sx={{
          flex: '1.55 1 0',
          position: 'relative',
          overflow: 'hidden',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          px: { md: 7, lg: 11 },
          background: C.leftBg
        }}
      >
        {/* 蓝图网格底纹 */}
        <Box
          sx={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(130% 100% at 40% 50%, #000 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(130% 100% at 40% 50%, #000 55%, transparent 100%)'
          }}
        />

        {/* 左上角品牌图标（仅图标，避免与大标题重复）*/}
        <Box sx={{ position: 'absolute', top: 36, left: { md: 44, lg: 60 }, zIndex: 3 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: '12px', background: C.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px rgba(110,137,233,0.34)' }}>
            <LogoIcon sx={{ fontSize: 25, color: '#fff' }} />
          </Box>
        </Box>

        {/* 标题 + 描述 */}
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 520 }}>
          <Typography sx={{ fontSize: { md: 44, lg: 54 }, fontWeight: 800, letterSpacing: '-0.5px', color: C.heading, lineHeight: 1.08 }}>
            Easy Dataset
          </Typography>
          <Typography sx={{ mt: 1.5, fontSize: { md: 18, lg: 20 }, fontWeight: 600, color: C.primary }}>
            团队协作 · 大模型微调数据集生产平台
          </Typography>
          <Typography sx={{ mt: 2.25, fontSize: 15, lineHeight: 1.9, color: C.body, maxWidth: 500 }}>
            从文档解析、智能分块到问题与答案生成，团队在同一平台上协作完成高质量训练数据的端到端构建，让微调数据的生产清晰、可控、可追溯。
          </Typography>
        </Box>

        {/* 居中主视觉 */}
        <Box sx={{ position: 'relative', zIndex: 2, alignSelf: 'center', mt: { md: 3, lg: 5 } }}>
          <HeroVisual reduceMotion={reduceMotion} />
        </Box>
      </Box>

      {/* ===== 右：登录卡 ===== */}
      <Box
        sx={{
          flex: '1 1 0',
          minWidth: { md: 440 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, sm: 6 },
          py: 6,
          background: '#fff'
        }}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 380 }}
        >
          {/* 移动端小 logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 4 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, background: C.btn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogoIcon sx={{ fontSize: 24, color: '#fff' }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: C.heading }}>Easy Dataset</Typography>
          </Box>

          <Typography sx={{ fontSize: 26, fontWeight: 800, color: C.heading }}>
            您好！欢迎登录
          </Typography>
          <Typography sx={{ mt: 1, mb: 4, fontSize: 14, color: C.muted }}>
            {showLocalForm ? '请输入账号与密码进入系统' : '使用中广核 4A 统一身份认证登录'}
          </Typography>

          {(error || queryError) && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, alignItems: 'center', '& .MuiAlert-message': { fontSize: 13.5 } }}>
              {error || queryError}
            </Alert>
          )}

          {!configLoaded ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={26} sx={{ color: C.primary }} />
            </Box>
          ) : showLocalForm ? (
            <Box component="form" onSubmit={handleLogin}>
              <TextField
                fullWidth
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                InputProps={{ startAdornment: (<InputAdornment position="start"><PersonOutline sx={{ color: C.muted, fontSize: 20 }} /></InputAdornment>) }}
                sx={fieldSx}
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
                  startAdornment: (<InputAdornment position="start"><LockOutlined sx={{ color: C.muted, fontSize: 20 }} /></InputAdornment>),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} sx={{ color: C.muted }}>
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={fieldSx}
              />

              <FormControlLabel
                control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} sx={{ color: C.border, '&.Mui-checked': { color: C.primary } }} />}
                label="记住账号"
                sx={{ mb: 1.5, '& .MuiFormControlLabel-label': { fontSize: 13.5, color: C.body } }}
              />

              <Button
                type="submit"
                fullWidth
                disableElevation
                disabled={loading || !username || !password}
                sx={{
                  py: 1.5, borderRadius: 2, textTransform: 'none', fontSize: 16, fontWeight: 600, color: '#fff',
                  background: C.btn,
                  boxShadow: '0 8px 22px rgba(110,137,233,0.30)',
                  '&:hover': { background: C.btnHover, boxShadow: '0 10px 28px rgba(110,137,233,0.38)' },
                  '&.Mui-disabled': { background: '#C9D3E8', color: '#fff', boxShadow: 'none' }
                }}
              >
                {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : '进 入 系 统'}
              </Button>

              {fourAEnabled && (
                <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 13 }}>
                  <Box component="a" href="/login" sx={{ color: C.primary, textDecoration: 'none', fontWeight: 500 }}>← 返回 4A 统一登录</Box>
                </Typography>
              )}
            </Box>
          ) : (
            <Box>
              <Button
                component="a"
                href="/api/auth/4a/login"
                fullWidth
                disableElevation
                startIcon={<LoginIcon />}
                sx={{
                  py: 1.5, borderRadius: 2, textTransform: 'none', fontSize: 16, fontWeight: 600, color: '#fff',
                  background: C.btn,
                  boxShadow: '0 8px 22px rgba(110,137,233,0.30)',
                  '&:hover': { background: C.btnHover, boxShadow: '0 10px 28px rgba(110,137,233,0.38)' }
                }}
              >
                使用 4A 统一身份登录
              </Button>
              <Typography sx={{ mt: 2.5, textAlign: 'center', fontSize: 13 }}>
                <Box component="a" href="/login?local=1" sx={{ color: C.muted, textDecoration: 'none' }}>管理员本地登录</Box>
              </Typography>
            </Box>
          )}

          <Typography sx={{ mt: 5, fontSize: 12, color: '#B7C1D6' }}>
            首次使用？请先初始化管理员账号
          </Typography>
        </motion.div>
      </Box>
    </Box>
  );
}
