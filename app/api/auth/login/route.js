import { NextResponse } from 'next/server';
import { createToken, comparePassword } from '@/lib/auth';
import { getUserByUsername, updateUser } from '@/lib/db/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookies';

// 简单的内存级登录失败计数（防止暴力破解）
// 生产环境建议替换为 Redis 或数据库存储
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;        // 最多尝试次数
const LOCKOUT_MINUTES = 15;    // 锁定时长（分钟）

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}

function isLocked(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  // 过期清除
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(ip);
  }
  return false;
}

function recordFailedAttempt(ip) {
  pruneAttemptsIfNeeded();
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null, lastTry: 0 };
  record.count++;
  record.lastTry = Date.now();
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
  }
  loginAttempts.set(ip, record);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// 防止 loginAttempts Map 无限增长（攻击者切换 IP 头）：定期清理过期记录
const MAX_MAP_SIZE = 10000;
function pruneAttemptsIfNeeded() {
  if (loginAttempts.size < MAX_MAP_SIZE) return;
  const now = Date.now();
  // 一小时未活动且未锁定的记录清掉
  for (const [ip, record] of loginAttempts) {
    if (!record.lockedUntil && (record.lastTry || 0) < now - 3600 * 1000) {
      loginAttempts.delete(ip);
    } else if (record.lockedUntil && now >= record.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}

export async function POST(request) {
  try {
    const ip = getClientIP(request);

    // 检查是否被锁定
    if (isLocked(ip)) {
      return Response.json(
        { error: `登录失败次数过多，请 ${LOCKOUT_MINUTES} 分钟后再试` },
        { status: 429 }
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    // 输入长度限制（防止超长字符串拖慢 bcrypt）
    if (typeof username !== 'string' || username.length > 50) {
      return Response.json({ error: '账号格式无效' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length > 128) {
      return Response.json({ error: '密码格式无效' }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      recordFailedAttempt(ip);
      return Response.json({ error: '账号或密码错误' }, { status: 401 });
    }

    if (user.status !== 1) {
      return Response.json({ error: '账号已被禁用，请联系管理员' }, { status: 403 });
    }

    const valid = comparePassword(password, user.passwordHash);
    if (!valid) {
      recordFailedAttempt(ip);
      return Response.json({ error: '账号或密码错误' }, { status: 401 });
    }

    // 登录成功，清除失败计数
    clearAttempts(ip);

    // 更新最后登录时间
    await updateUser(user.id, { lastLoginAt: new Date() });

    const token = await createToken(user);

    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
    // 同时写会话 Cookie：使 4A 网关启用时本地后门登录也能通过 middleware（§6.7）
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: '登录失败' }, { status: 500 });
  }
}
