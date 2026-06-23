'use client';

import React, { useCallback } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { currentUserAtom, tokenAtom } from '@/lib/auth-context';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LanguageSwitcher from '../LanguageSwitcher';
import UpdateChecker from '../UpdateChecker';
import TaskIcon from '../TaskIcon';
import ModelSelect from '../ModelSelect';
import * as styles from './styles';

// 始终可见的按钮样式（不随屏幕宽度隐藏）
const alwaysVisible = (theme) => ({
  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.2)',
  color: theme.palette.mode === 'dark' ? 'inherit' : 'white',
  borderRadius: 1.5,
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.35)'
  }
});

export default function ActionButtons({
  theme, resolvedTheme, toggleTheme, isProjectDetail, currentProject, onActionAreaEnter
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const currentUser = useAtomValue(currentUserAtom);
  const setToken = useSetAtom(tokenAtom);
  const isZhLanguage = String(i18n.language || '').toLowerCase().startsWith('zh');
  const isAdmin = currentUser?.role === 'admin';

  const handleLogout = useCallback(async () => {
    // 先调后端清会话 Cookie(ed_session)+可选 4A SLO，否则 4A 登录态仍在
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 忽略，仍清本地 */
    }
    localStorage.removeItem('easy-dataset-token');
    setToken(null);
    router.push('/login');
  }, [setToken, router]);

  const ab = alwaysVisible(theme);

  return (
    <Box sx={styles.actionAreaStyles} onMouseEnter={onActionAreaEnter}>
      {isProjectDetail && <ModelSelect projectId={currentProject} />}
      {isProjectDetail && <TaskIcon theme={theme} projectId={currentProject} />}

      {/* Admin buttons - always visible */}
      {isAdmin && !isProjectDetail && (
        <>
          <Tooltip title="用户管理">
            <IconButton component="a" href="/admin/users" size="medium" sx={ab}>
              <PeopleIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="团队管理">
            <IconButton component="a" href="/admin/teams" size="medium" sx={ab}>
              <GroupsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="操作日志">
            <IconButton component="a" href="/admin/logs" size="medium" sx={ab}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
        </>
      )}

      {!isProjectDetail && (
        <Tooltip title={t('monitoring.title', 'Resource Monitoring')}>
          <IconButton component="a" href="/monitoring" size="medium" sx={ab}>
            <BarChartIcon />
          </IconButton>
        </Tooltip>
      )}

      <LanguageSwitcher />

      <Tooltip title={resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}>
        <IconButton onClick={toggleTheme} size="medium" sx={ab}>
          {resolvedTheme === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title={t('documentation')}>
        <IconButton component="a" href={isZhLanguage ? 'https://docs.easy-dataset.com/' : 'https://docs.easy-dataset.com/ed/en'}
          target="_blank" rel="noopener noreferrer" size="medium" sx={ab}>
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={t('common.visitGitHub', 'View on GitHub')}>
        <IconButton component="a" href="https://github.com/ConardLi/easy-dataset"
          target="_blank" rel="noopener noreferrer" size="medium" sx={ab}>
          <GitHubIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ display: { xs: 'none', xl: 'flex' } }}>
        <UpdateChecker />
      </Box>

      {/* 当前登录用户 + Logout - always visible */}
      {currentUser && (
        <>
          <Tooltip
            title={`账号：${currentUser.username}　角色：${currentUser.role === 'admin' ? '管理员' : '普通用户'}${
              currentUser.orgName ? `　机构：${currentUser.orgName}` : ''
            }`}
          >
            <Box
              sx={{
                ...ab,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                fontSize: '0.85rem',
                cursor: 'default'
              }}
            >
              <AccountCircleIcon fontSize="small" />
              {currentUser.displayName}
              {currentUser.orgName && (
                <Box component="span" sx={{ ml: 0.5, opacity: 0.6, fontSize: '0.75rem' }}>
                  · {currentUser.orgName}
                </Box>
              )}
            </Box>
          </Tooltip>
          <Tooltip title="退出登录">
            <IconButton onClick={handleLogout} size="medium" sx={ab}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
