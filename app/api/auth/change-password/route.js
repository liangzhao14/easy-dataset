import { hashPassword } from '@/lib/auth';
import { getCurrentUser } from '@/lib/auth/middleware';
import { getUserById, updateUser } from '@/lib/db/users';

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return Response.json({ error: '请输入旧密码和新密码' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return Response.json({ error: '新密码至少 8 位，建议包含字母与数字' }, { status: 400 });
    }
    if (newPassword.length > 128) {
      return Response.json({ error: '新密码不能超过 128 字符' }, { status: 400 });
    }
    if (newPassword === oldPassword) {
      return Response.json({ error: '新密码不能与旧密码相同' }, { status: 400 });
    }

    const { comparePassword } = await import('@/lib/auth');
    const fullUser = await getUserById(user.id);
    const valid = comparePassword(oldPassword, fullUser.passwordHash);

    if (!valid) {
      return Response.json({ error: '旧密码错误' }, { status: 400 });
    }

    await updateUser(user.id, { passwordHash: hashPassword(newPassword) });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return Response.json({ error: '修改密码失败' }, { status: 500 });
  }
}
