'use client';

import { useState, useEffect } from 'react';
import {
  Container, Typography, Grid, Card, CardContent, Box, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, ToggleButtonGroup, ToggleButton, CircularProgress
} from '@mui/material';
import {
  FolderOutlined, DescriptionOutlined, QuizOutlined, CheckCircleOutline,
  DataArray, TrendingUp
} from '@mui/icons-material';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/Navbar/index';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '@/lib/auth-context';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer
} from 'recharts';

const STAGE_COLORS = { '未开始': 'default', '文件解析完成': 'info', '问题生成完成': 'warning', '标注中': 'primary', '标注完成': 'success' };
const STAGE_LABELS = { '未开始': '未开始', '文件解析完成': '文件就绪', '问题生成完成': '问题就绪', '数据集就绪': '数据集就绪', '标注中': '标注中', '标注完成': '已完成' };
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];

function MonitoringPage() {
  const token = useAtomValue(tokenAtom);
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [trend, setTrend] = useState([]);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('/api/monitoring?type=stats', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/monitoring?type=overview', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/monitoring?type=ranking&period=${period}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/monitoring?type=annotation-trend', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([s, o, r, tr]) => {
      if (s.stats) setStats(s.stats);
      if (o.overview) setOverview(o.overview);
      if (r.ranking) setRanking(r.ranking);
      if (tr.trend) setTrend(tr.trend);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [token, period]);

  if (loading) {
    return <AuthGuard><Navbar /><Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box></AuthGuard>;
  }

  return (
    <AuthGuard>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>监控看板</Typography>

        {/* Global Stats */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {[
              { icon: <FolderOutlined />, label: '项目数', value: stats.projects, color: '#6366f1' },
              { icon: <DescriptionOutlined />, label: '文件数', value: stats.fileCount, color: '#3b82f6' },
              { icon: <QuizOutlined />, label: '问题数', value: stats.questionCount, color: '#8b5cf6' },
              { icon: <DataArray />, label: '数据集', value: stats.datasetCount, color: '#f59e0b' },
              { icon: <CheckCircleOutline />, label: '已标注', value: stats.confirmedCount, color: '#10b981' },
              { icon: <TrendingUp />, label: '完成率', value: `${stats.avgCompletionRate}%`, color: '#ef4444' }
            ].map((item, i) => (
              <Grid item xs={6} sm={4} md={2} key={i}>
                <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Box sx={{ color: item.color, mb: 1 }}>{item.icon}</Box>
                    <Typography variant="h5" fontWeight={700}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Project Overview Table */}
        <Paper sx={{ borderRadius: 3, mb: 4, overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={600}>项目总览</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>项目名</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>负责人</TableCell>
                  <TableCell align="right">文件</TableCell>
                  <TableCell align="right">问题</TableCell>
                  <TableCell align="right">数据集</TableCell>
                  <TableCell>阶段</TableCell>
                  <TableCell align="right">完成率</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.map(p => (
                  <TableRow key={p.id} hover>
                    <TableCell><strong>{p.name}</strong></TableCell>
                    <TableCell>
                      <Chip label={p.projectType === 'demo' ? '示范' : p.projectType === 'team' ? '团队' : '个人'} size="small"
                        color={p.projectType === 'demo' ? 'info' : p.projectType === 'team' ? 'secondary' : 'default'} />
                    </TableCell>
                    <TableCell>{p.ownerName}</TableCell>
                    <TableCell align="right">{p.fileCount}</TableCell>
                    <TableCell align="right">{p.questionCount}</TableCell>
                    <TableCell align="right">{p.datasetCount}</TableCell>
                    <TableCell>
                      <Chip label={STAGE_LABELS[p.stage] || p.stage} size="small"
                        color={STAGE_COLORS[p.stage] || 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={p.completionRate}
                          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: p.completionRate === 100 ? '#10b981' : '#6366f1' }
                          }} />
                        <Typography variant="caption" sx={{ minWidth: 35 }}>{p.completionRate}%</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {overview.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>暂无项目</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* 标注统计图表（折线趋势 + 人员占比） */}
        <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
          <Paper sx={{ borderRadius: 3, p: 3, flex: '1 1 60%', minWidth: 360 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>标注趋势（近 30 天）</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip />
                <Line type="monotone" dataKey="count" name="标注数" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
          <Paper sx={{ borderRadius: 3, p: 3, flex: '1 1 30%', minWidth: 280 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>标注人占比</Typography>
            {ranking.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={ranking.map(r => ({ name: r.displayName, value: r.count }))}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                  >
                    {ranking.map((r, i) => <Cell key={r.userId} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip />
                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                暂无标注数据
              </Box>
            )}
          </Paper>
        </Box>

        {/* Annotation Ranking */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={600}>标注排行</Typography>
            <ToggleButtonGroup size="small" value={period} exclusive
              onChange={(_, v) => v && setPeriod(v)}>
              <ToggleButton value="today">今日</ToggleButton>
              <ToggleButton value="week">本周</ToggleButton>
              <ToggleButton value="month">本月</ToggleButton>
              <ToggleButton value="all">全部</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }}>排名</TableCell>
                  <TableCell>用户</TableCell>
                  <TableCell align="right">标注数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ranking.map((r, i) => (
                  <TableRow key={r.userId} hover>
                    <TableCell>
                      <Chip label={`#${r.rank}`} size="small"
                        color={i === 0 ? 'warning' : i === 1 ? 'default' : i === 2 ? 'default' : 'default'}
                        variant={i < 3 ? 'filled' : 'outlined'}
                        sx={i === 0 ? { bgcolor: '#f59e0b', color: '#fff' } : i === 1 ? { bgcolor: '#94a3b8', color: '#fff' } : i === 2 ? { bgcolor: '#cd853f', color: '#fff' } : {}} />
                    </TableCell>
                    <TableCell><strong>{r.displayName}</strong> <Typography variant="caption" color="text.secondary">@{r.username}</Typography></TableCell>
                    <TableCell align="right"><strong>{r.count}</strong></TableCell>
                  </TableRow>
                ))}
                {ranking.length === 0 && (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>暂无标注数据</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </AuthGuard>
  );
}

export default function Page() { return <MonitoringPage />; }
