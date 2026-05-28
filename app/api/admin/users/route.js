import { withAuth } from '@/lib/auth/middleware';
import { listUsers, createUser, updateUser } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth';

// 获取用户列表 - 仅管理员
export const GET = withAuth(async function (request) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || undefined;
    const status = url.searchParams.has('status') ? parseInt(url.searchParams.get('status')) : undefined;

    const users = await listUsers({ role, status });
    return Response.json(users);
  } catch (error) {
    console.error('List users error:', error);
    return Response.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}, { requireAdmin: true });

// 创建用户 - 仅管理员
export const POST = withAuth(async function (request) {
  try {
    const { username, displayName, password, role } = await request.json();

    if (!username || !password) {
      return Response.json({ error: '请填写账号和密码' }, { status: 400 });
    }

    // 长度限制
    if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
      return Response.json({ error: '账号长度需在 3-50 之间' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_\-一-龥]+$/.test(username)) {
      return Response.json({ error: '账号只能包含字母、数字、下划线、连字符或中文' }, { status: 400 });
    }
    if (displayName && displayName.length > 50) {
      return Response.json({ error: '显示名称不能超过 50 字符' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: '密码至少 8 位，建议包含字母与数字' }, { status: 400 });
    }
    if (password.length > 128) {
      return Response.json({ error: '密码不能超过 128 字符' }, { status: 400 });
    }
    if (role && !['admin', 'user'].includes(role)) {
      return Response.json({ error: '无效的角色' }, { status: 400 });
    }

    const { getUserByUsername } = await import('@/lib/db/users');
    const existing = await getUserByUsername(username);
    if (existing) {
      return Response.json({ error: '账号已存在' }, { status: 400 });
    }

    const user = await createUser({
      username,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      role: role || 'user'
    });

    return Response.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status
    });
  } catch (error) {
    console.error('Create user error:', error);
    return Response.json({ error: '创建用户失败' }, { status: 500 });
  }
}, { requireAdmin: true });
