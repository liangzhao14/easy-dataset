import { countUsers } from '@/lib/db/users';
import { db } from '@/lib/db/index';

export async function GET() {
  try {
    const userCount = await countUsers();
    return Response.json({ needsInit: userCount === 0, userCount });
  } catch (error) {
    console.error('Init check error:', error);
    return Response.json({ needsInit: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { username, displayName, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: '请填写账号和密码' }, { status: 400 });
    }

    if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
      return Response.json({ error: '账号长度需在 3-50 之间' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return Response.json({ error: '密码至少 8 位，建议包含字母与数字' }, { status: 400 });
    }
    if (password.length > 128) {
      return Response.json({ error: '密码不能超过 128 字符' }, { status: 400 });
    }

    if (displayName && displayName.length > 50) {
      return Response.json({ error: '显示名称不能超过 50 字符' }, { status: 400 });
    }

    const { hashPassword } = await import('@/lib/auth');

    // 使用事务保证 countUsers + createUser 的原子性，避免并发初始化
    try {
      await db.$transaction(async (tx) => {
        const userCount = await tx.users.count();
        if (userCount > 0) {
          throw new Error('ALREADY_INITIALIZED');
        }
        await tx.users.create({
          data: {
            username,
            displayName: displayName || username,
            passwordHash: hashPassword(password),
            role: 'admin'
          }
        });
      });
    } catch (txError) {
      if (txError.message === 'ALREADY_INITIALIZED') {
        return Response.json({ error: '已有用户，无需初始化' }, { status: 400 });
      }
      throw txError;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Init admin error:', error);
    return Response.json({ error: '初始化失败: ' + error.message }, { status: 500 });
  }
}
