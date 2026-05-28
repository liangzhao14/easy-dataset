'use client';

import { useState, useEffect } from 'react';
import { Container, Box, Typography, CircularProgress, Stack, useTheme } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/Navbar/index';
import HeroSection from '@/components/home/HeroSection';
import ProjectList from '@/components/home/ProjectList';
import CreateProjectDialog from '@/components/home/CreateProjectDialog';
import MigrationDialog from '@/components/home/MigrationDialog';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';

function HomeContent() {
  const { t } = useTranslation();
  const token = useAtomValue(tokenAtom);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [unmigratedProjects, setUnmigratedProjects] = useState([]);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const response = await fetch('/api/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error(t('projects.fetchFailed'));
        }

        const data = await response.json();
        setProjects(data);

        await checkUnmigratedProjects();
      } catch (error) {
        console.error(t('projects.fetchError'), String(error));
        setError(String(error));
      } finally {
        setLoading(false);
      }
    }

    async function checkUnmigratedProjects() {
      try {
        const response = await fetch('/api/projects/unmigrated', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) return;

        const { success, data } = await response.json();
        if (success && Array.isArray(data) && data.length > 0) {
          setUnmigratedProjects(data);
          setMigrationDialogOpen(true);
        }
      } catch (error) {
        console.error('检查未迁移项目出错', error);
      }
    }

    if (token) fetchProjects();
  }, [token]);

  const theme = useTheme();

  return (
    <main style={{ overflow: 'hidden', position: 'relative' }}>
      <Navbar projects={projects} />

      <HeroSection onCreateProject={() => setCreateDialogOpen(true)} />

      <Container
        maxWidth="lg"
        sx={{
          mt: { xs: 6, md: 8 },
          mb: { xs: 4, md: 6 },
          position: 'relative',
          zIndex: 1
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', mt: 6,
            flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={40} thickness={4} />
            <Typography variant="body2" color="text.secondary">{t('projects.loading')}</Typography>
          </Box>
        )}

        {error && !loading && (
          <Box component={motion.div} initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
            sx={{ mt: 4, p: 3, bgcolor: 'error.light', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ErrorOutlineIcon color="error" />
              <Typography color="error.dark">{t('projects.fetchFailed')}: {error}</Typography>
            </Stack>
          </Box>
        )}

        {!loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}>
            <ProjectList projects={projects} onCreateProject={() => setCreateDialogOpen(true)} />
          </motion.div>
        )}
      </Container>

      <CreateProjectDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <MigrationDialog open={migrationDialogOpen} onClose={() => setMigrationDialogOpen(false)}
        projectIds={unmigratedProjects} />
    </main>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}
