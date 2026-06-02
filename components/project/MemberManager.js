'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Select, MenuItem, FormControl, InputLabel, List, ListItem,
  ListItemText, Tooltip
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as OwnerIcon
} from '@mui/icons-material';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';

const ROLE_LABELS = { owner: '拥有者', editor: '编辑者', annotator: '标注员', viewer: '查看者' };
const ROLE_COLORS = { owner: 'primary', editor: 'success', annotator: 'warning', viewer: 'default' };

export default function MemberManager({ projectId, isOwner, ownerId }) {
  const token = useAtomValue(tokenAtom);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('editor');

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
    }
  };

  useEffect(() => { if (token) { fetchMembers(); fetchUsers(); } }, [token]);

  const handleAddMember = async (userId) => {
    await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role: selectedRole })
    });
    setDialogOpen(false);
    fetchMembers();
  };

  const handleRemoveMember = async (userId) => {
    await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchMembers();
  };

  const handleChangeRole = async (userId, role) => {
    await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role })
    });
    fetchMembers();
  };

  const availableUsers = users.filter(u =>
    u.id !== ownerId &&
    !members.some(m => m.userId === u.id || m.user?.id === u.id)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">项目成员</Typography>
        {isOwner && (
          <Button startIcon={<PersonAddIcon />} onClick={() => setDialogOpen(true)}>
            添加成员
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>用户名</TableCell>
              <TableCell>账号</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>加入时间</TableCell>
              {isOwner && <TableCell align="right">操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map(m => {
              const user = m.user || {};
              return (
                <TableRow key={m.userId || m.id}>
                  <TableCell><strong>{user.displayName || '-'}</strong></TableCell>
                  <TableCell>@{user.username || '-'}</TableCell>
                  <TableCell>
                    {isOwner && m.role !== 'owner' ? (
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select value={m.role}
                          onChange={e => handleChangeRole(m.userId || user.id, e.target.value)}>
                          <MenuItem value="editor">编辑者</MenuItem>
                          <MenuItem value="annotator">标注员</MenuItem>
                          <MenuItem value="viewer">查看者</MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Chip
                        label={ROLE_LABELS[m.role] || m.role}
                        size="small"
                        color={ROLE_COLORS[m.role] || 'default'}
                        icon={m.role === 'owner' ? <OwnerIcon /> : undefined}
                      />
                    )}
                  </TableCell>
                  <TableCell>{m.createAt ? new Date(m.createAt).toLocaleDateString() : '-'}</TableCell>
                  {isOwner && (
                    <TableCell align="right">
                      {m.role !== 'owner' && (
                        <Tooltip title="移除成员">
                          <IconButton size="small" color="error"
                            onClick={() => handleRemoveMember(m.userId || user.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无成员，点击"添加成员"邀请协作者
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Member Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加项目成员</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>选择角色</InputLabel>
            <Select value={selectedRole} label="选择角色"
              onChange={e => setSelectedRole(e.target.value)}>
              <MenuItem value="editor">编辑者 - 可上传文件、生成问题和答案</MenuItem>
              <MenuItem value="annotator">标注员 - 仅可标注和确认问答对</MenuItem>
              <MenuItem value="viewer">查看者 - 仅可查看</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>选择用户：</Typography>
          <List dense>
            {availableUsers.map(u => (
              <ListItem key={u.id} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}
                onClick={() => handleAddMember(u.id)}>
                <ListItemText
                  primary={u.displayName}
                  secondary={`@${u.username} · ${u.role === 'admin' ? '管理员' : '普通用户'}`}
                />
                <Chip label="添加" size="small" color="primary" />
              </ListItem>
            ))}
            {availableUsers.length === 0 && (
              <ListItem><ListItemText primary="所有用户已添加" /></ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
