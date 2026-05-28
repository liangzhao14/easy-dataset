'use client';

import { useState, useEffect } from 'react';
import {
  Container, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, Box
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, LockReset as ResetIcon,
  Block as BlockIcon, Delete as DeleteIcon, CheckCircle as EnableIcon
} from '@mui/icons-material';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/Navbar/index';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';

function AdminUsersPage() {
  const token = useAtomValue(tokenAtom);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({ username: '', displayName: '', password: '', role: 'user' });
  const [editForm, setEditForm] = useState({ displayName: '', role: '' });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchUsers(); }, [token]);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCreateOpen(false);
      setCreateForm({ username: '', displayName: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) { setError(err.message); }
  };

  const handleEdit = async () => {
    try {
      await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });
      setEditOpen(false);
      fetchUsers();
    } catch (err) { console.error(err); }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({ displayName: user.displayName, role: user.role });
    setEditOpen(true);
  };

  const handleToggleStatus = async (user) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: user.status === 1 ? 0 : 1 })
    });
    fetchUsers();
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDeleteOpen(false);
      fetchUsers();
    } catch (err) { alert(err.message); }
  };

  const handleResetPassword = async () => {
    const password = prompt('请输入新密码（至少6位）：');
    if (!password || password.length < 6) return alert('密码至少6位');
    await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password })
    });
    setResetOpen(false);
    alert('密码已重置');
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>用户管理</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>创建用户</Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>账号</TableCell>
                <TableCell>显示名称</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>创建时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>
                    <Chip label={user.role === 'admin' ? '管理员' : '普通用户'} size="small"
                      color={user.role === 'admin' ? 'primary' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Chip label={user.status === 1 ? '正常' : '禁用'} size="small"
                      color={user.status === 1 ? 'success' : 'error'} />
                  </TableCell>
                  <TableCell>{new Date(user.createAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(user)} title="编辑">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => { setSelectedUser(user); setResetOpen(true); }} title="重置密码">
                      <ResetIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleToggleStatus(user)}
                      title={user.status === 1 ? '禁用' : '启用'}>
                      {user.status === 1
                        ? <BlockIcon fontSize="small" color="error" />
                        : <EnableIcon fontSize="small" color="success" />}
                    </IconButton>
                    {user.role !== 'admin' && (
                      <IconButton size="small" onClick={() => { setSelectedUser(user); setDeleteOpen(true); }} title="删除">
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Create Dialog */}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
          <DialogTitle>创建用户</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            <TextField fullWidth label="账号" value={createForm.username}
              onChange={e => setCreateForm({ ...createForm, username: e.target.value })} margin="normal" />
            <TextField fullWidth label="显示名称" value={createForm.displayName}
              onChange={e => setCreateForm({ ...createForm, displayName: e.target.value })} margin="normal" />
            <TextField fullWidth label="密码" type="password" value={createForm.password}
              onChange={e => setCreateForm({ ...createForm, password: e.target.value })} margin="normal" />
            <FormControl fullWidth margin="normal">
              <InputLabel>角色</InputLabel>
              <Select value={createForm.role} label="角色"
                onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                <MenuItem value="user">普通用户</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button variant="contained" onClick={handleCreate} disabled={!createForm.username || !createForm.password}>创建</Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
          <DialogTitle>编辑用户 — {selectedUser?.username}</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="显示名称" value={editForm.displayName}
              onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} margin="normal" />
            <FormControl fullWidth margin="normal">
              <InputLabel>角色</InputLabel>
              <Select value={editForm.role} label="角色"
                onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                <MenuItem value="user">普通用户</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>取消</Button>
            <Button variant="contained" onClick={handleEdit}>保存</Button>
          </DialogActions>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
          <DialogTitle>重置密码 — {selectedUser?.username}</DialogTitle>
          <DialogActions>
            <Button onClick={() => setResetOpen(false)}>取消</Button>
            <Button variant="contained" color="warning" onClick={handleResetPassword}>确认重置</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
          <DialogTitle>删除用户</DialogTitle>
          <DialogContent>
            <Typography>确定要删除用户 <strong>{selectedUser?.displayName}</strong> (@{selectedUser?.username}) 吗？</Typography>
            <Typography variant="caption" color="text.secondary">此操作将禁用该用户账号。</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}

export default function Page() {
  return <AuthGuard requireAdmin><AdminUsersPage /></AuthGuard>;
}
