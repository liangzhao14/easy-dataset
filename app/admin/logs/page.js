'use client';

import { useState, useEffect } from 'react';
import {
  Container, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Box,
  Select, MenuItem, FormControl, InputLabel, TablePagination, TextField
} from '@mui/material';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/Navbar/index';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';

const ACTION_LABELS = {
  create_project: '创建项目', update_project: '更新项目', delete_project: '删除项目',
  confirm_dataset: '确认标注', unconfirm_dataset: '取消确认', update_dataset: '更新数据集',
  create_user: '创建用户', update_user: '编辑用户', disable_user: '禁用用户',
  create_team: '创建团队', delete_team: '删除团队', add_team_member: '添加成员', remove_team_member: '移除成员'
};

function AdminLogsPage() {
  const token = useAtomValue(tokenAtom);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterTarget, setFilterTarget] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page + 1, pageSize,
        ...(filterAction && { action: filterAction }),
        ...(filterTarget && { targetType: filterTarget })
      });
      const res = await fetch(`/api/admin/operation-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchLogs(); }, [token, page, pageSize, filterAction, filterTarget]);

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>操作日志</Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>操作类型</InputLabel>
            <Select value={filterAction} label="操作类型"
              onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
              <MenuItem value="">全部</MenuItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>对象类型</InputLabel>
            <Select value={filterTarget} label="对象类型"
              onChange={e => { setFilterTarget(e.target.value); setPage(0); }}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="project">项目</MenuItem>
              <MenuItem value="dataset">数据集</MenuItem>
              <MenuItem value="user">用户</MenuItem>
              <MenuItem value="team">团队</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>时间</TableCell>
                <TableCell>操作人</TableCell>
                <TableCell>操作</TableCell>
                <TableCell>对象类型</TableCell>
                <TableCell>对象 ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createAt).toLocaleString('zh-CN')}</TableCell>
                  <TableCell><strong>{log.operator?.displayName || log.operatorName}</strong></TableCell>
                  <TableCell>
                    <Chip label={ACTION_LABELS[log.action] || log.action} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{log.targetType}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {log.targetId?.substring(0, 12)}...
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>暂无日志</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={pageSize}
          onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value)); setPage(0); }}
          labelRowsPerPage="每页:" labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 条`}
        />
      </Container>
    </>
  );
}

export default function Page() {
  return (
    <AuthGuard requireAdmin>
      <AdminLogsPage />
    </AuthGuard>
  );
}
