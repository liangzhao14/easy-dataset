'use client';

import { useState, useEffect } from 'react';
import { Container, Typography, Box, Tabs, Tab, Paper, Alert, CircularProgress } from '@mui/material';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { tokenAtom, currentUserAtom } from '@/lib/auth-context';

// 导入设置组件
import BasicSettings from '@/components/settings/BasicSettings';
import ModelSettings from '@/components/settings/ModelSettings';
import TaskSettings from '@/components/settings/TaskSettings';
import PromptSettings from './components/PromptSettings';
import MemberManager from '@/components/project/MemberManager';

// 定义 TAB 枚举
const TABS = {
  BASIC: 'basic',
  MODEL: 'model',
  TASK: 'task',
  PROMPTS: 'prompts',
  MEMBERS: 'members'
};

export default function SettingsPage({ params }) {
  const { t } = useTranslation();
  const { projectId } = params;
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useAtomValue(tokenAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const [activeTab, setActiveTab] = useState(TABS.BASIC);
  const [projectExists, setProjectExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && Object.values(TABS).includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    async function checkProject() {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          if (response.status === 404) {
            setProjectExists(false);
          } else {
            throw new Error(t('projects.fetchFailed'));
          }
        } else {
          const data = await response.json();
          setProject(data);
          setProjectExists(true);
        }
      } catch (error) {
        console.error('获取项目详情出错:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) checkProject();
  }, [projectId, token]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    router.push(`/projects/${projectId}/settings?tab=${newValue}`);
  };

  const isOwner = project?.ownerId === currentUser?.id || currentUser?.role === 'admin';

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!projectExists) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{t('projects.notExist')}</Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth"
          textColor="primary" indicatorColor="primary">
          <Tab value={TABS.BASIC} label={t('settings.basicInfo')} />
          <Tab value={TABS.MODEL} label={t('settings.modelConfig')} />
          <Tab value={TABS.TASK} label={t('settings.taskConfig')} />
          <Tab value={TABS.PROMPTS} label={t('settings.promptConfig')} />
          <Tab value={TABS.MEMBERS} label="成员管理" />
        </Tabs>
      </Paper>

      {activeTab === TABS.BASIC && <BasicSettings projectId={projectId} />}
      {activeTab === TABS.MODEL && <ModelSettings projectId={projectId} />}
      {activeTab === TABS.TASK && <TaskSettings projectId={projectId} />}
      {activeTab === TABS.PROMPTS && <PromptSettings projectId={projectId} />}
      {activeTab === TABS.MEMBERS && <MemberManager projectId={projectId} isOwner={isOwner} ownerId={project?.ownerId} />}
    </Container>
  );
}
