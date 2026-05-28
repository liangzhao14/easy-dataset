'use client';

import { useState, useEffect } from 'react';
import {
  Container, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Box, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, People as PeopleIcon } from '@mui/icons-material';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/Navbar/index';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';

function AdminTeamsPage() {
  const token = useAtomValue(tokenAtom);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/admin/teams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTeams(data);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => { if (token) { fetchTeams(); fetchUsers(); } }, [token]);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDialogOpen(false);
      setForm({ name: '', description: '' });
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (teamId) => {
    if (!confirm('确定删除该团队？')) return;
    await fetch(`/api/admin/teams/${teamId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTeams();
  };

  const handleAddMember = async (teamId, userId) => {
    await fetch(`/api/admin/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
    // Refresh teams and update selectedTeam in dialog
    const res = await fetch('/api/admin/teams', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setTeams(data);
    // Update selected team so dialog shows new member immediately
    const updated = data.find(t => t.id === teamId);
    if (updated) setSelectedTeam(updated);
  };

  const handleRemoveMember = async (teamId, userId) => {
    await fetch(`/api/admin/teams/${teamId}/members?userId=${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await fetch('/api/admin/teams', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setTeams(data);
    const updated = data.find(t => t.id === teamId);
    if (updated) setSelectedTeam(updated);
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>团队管理</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            创建团队
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>团队名称</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>成员数</TableCell>
                <TableCell>项目数</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map(team => (
                <TableRow key={team.id}>
                  <TableCell><strong>{team.name}</strong></TableCell>
                  <TableCell>{team.description || '-'}</TableCell>
                  <TableCell>
                    <Chip label={team._count?.members || 0} size="small"
                      icon={<PeopleIcon />}
                      onClick={() => { setSelectedTeam(team); setMemberDialogOpen(true); }} />
                  </TableCell>
                  <TableCell>{team._count?.projects || 0}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setSelectedTeam(team); setMemberDialogOpen(true); }}>
                      <PeopleIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(team.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Create Team Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>创建团队</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="团队名称" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" />
            <TextField fullWidth label="描述" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} margin="normal" multiline rows={2} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>取消</Button>
            <Button variant="contained" onClick={handleCreate} disabled={!form.name}>创建</Button>
          </DialogActions>
        </Dialog>

        {/* Members Dialog */}
        <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>团队成员 - {selectedTeam?.name}</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>当前成员：</Typography>
            <List dense>
              {selectedTeam?.members?.map(m => (
                <ListItem key={m.userId}>
                  <ListItemText
                    primary={m.user.displayName}
                    secondary={`@${m.user.username} · ${m.role === 'owner' ? '管理者' : '成员'}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" color="error"
                      onClick={() => handleRemoveMember(selectedTeam.id, m.userId)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {(!selectedTeam?.members || selectedTeam.members.length === 0) && (
                <ListItem><ListItemText primary="暂无成员" /></ListItem>
              )}
            </List>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>添加成员：</Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {users.filter(u =>
                    !selectedTeam?.members?.some(m => m.userId === u.id)
                  ).map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.displayName} (@{u.username})</TableCell>
                      <TableCell>
                        <Chip label={u.role === 'admin' ? '管理员' : '用户'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => handleAddMember(selectedTeam.id, u.id)}>
                          添加
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMemberDialogOpen(false)}>关闭</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard requireAdmin>
      <AdminTeamsPage />
    </AuthGuard>
  );
}
