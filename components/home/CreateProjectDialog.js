'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, useTheme,
  CircularProgress, FormControl, FormHelperText, InputLabel, Select, MenuItem, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { Person, Groups, Visibility } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { tokenAtom, currentUserAtom } from '@/lib/auth-context';

export default function CreateProjectDialog({ open, onClose }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const token = useAtomValue(tokenAtom);
  const currentUser = useAtomValue(currentUserAtom);

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reuseConfigFrom: '',
    projectType: 'personal',
    teamId: ''
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const [projRes, teamRes] = await Promise.all([
          fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/teams', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (teamRes.ok) setTeams(await teamRes.json());
      } catch (e) { console.error('Failed to fetch:', e); }
    };
    fetchData();
  }, [token]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (e, newType) => {
    if (newType === 'demo' && currentUser?.role !== 'admin') return;
    setFormData(prev => ({ ...prev, projectType: newType || 'personal', teamId: newType === 'team' ? prev.teamId : '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('projects.createFailed'));
      }

      const data = await response.json();
      router.push(`/projects/${data.id}/settings?tab=model`);
    } catch (err) {
      console.error(t('projects.createError'), err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle>
        <Typography variant="h5" fontWeight="bold">{t('projects.createNew')}</Typography>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {/* Project Type */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>项目类型</Typography>
          <ToggleButtonGroup value={formData.projectType} exclusive
            onChange={handleTypeChange} size="small" sx={{ mb: 2, width: '100%' }}>
            <ToggleButton value="personal" sx={{ flex: 1 }}>
              <Person fontSize="small" sx={{ mr: 0.5 }} /> 个人项目
            </ToggleButton>
            <ToggleButton value="team" sx={{ flex: 1 }}>
              <Groups fontSize="small" sx={{ mr: 0.5 }} /> 团队项目
            </ToggleButton>
            {currentUser?.role === 'admin' && (
              <ToggleButton value="demo" sx={{ flex: 1 }}>
                <Visibility fontSize="small" sx={{ mr: 0.5 }} /> 示范项目
              </ToggleButton>
            )}
          </ToggleButtonGroup>

          {/* Team selector for team projects */}
          {formData.projectType === 'team' && (
            <FormControl fullWidth sx={{ mb: 2 }} required error={!formData.teamId}>
              <InputLabel>选择团队</InputLabel>
              <Select name="teamId" value={formData.teamId} label="选择团队" onChange={handleChange}>
                <MenuItem value=""><em>请选择团队</em></MenuItem>
                {teams.map(team => (
                  <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                ))}
              </Select>
              {!formData.teamId && (
                <FormHelperText>
                  {teams.length === 0
                    ? '您当前不属于任何团队，请联系管理员加入团队后再创建团队项目'
                    : '请选择团队后再创建'}
                </FormHelperText>
              )}
            </FormControl>
          )}

          {formData.projectType === 'demo' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              示范项目所有用户可见但仅可查看，仅管理员可编辑。
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <TextField name="name" label={t('projects.name')} fullWidth required
              value={formData.name} onChange={handleChange} sx={{ mb: 2 }} />
            <TextField name="description" label={t('projects.description')} fullWidth multiline rows={4}
              value={formData.description} onChange={handleChange} />
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>{t('projects.reuseConfig')}</InputLabel>
              <Select name="reuseConfigFrom" value={formData.reuseConfigFrom}
                onChange={handleChange} label={t('projects.reuseConfig')}>
                <MenuItem value="">{t('projects.noReuse')}</MenuItem>
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained"
            disabled={loading || !formData.name || (formData.projectType === 'team' && !formData.teamId)}
            sx={{ background: theme.palette.gradient?.primary }}>
            {loading ? <CircularProgress size={24} /> : t('home.createProject')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function Alert({ severity, children, sx }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: 2, mb: 2,
      bgcolor: severity === 'info' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${severity === 'info' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
      ...sx
    }}>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}
