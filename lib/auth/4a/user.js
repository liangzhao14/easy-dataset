// 4A 用户建号 / 复用（设计 D-2 / §5）。
// ⚠️ Node-only（crypto + Prisma）——禁止被 Edge middleware import。
import crypto from 'crypto';
import { db } from '@/lib/db/index';

/**
 * 按工号建号或复用（race-safe upsert，应对并发回调 §13.6）。
 * - 首次：username=工号、displayName=姓名(空则兜底工号)、authSource='4a'、role='user'、status=1，不建任何 ProjectMembers。
 * - 复用：仅刷新 displayName / orgName / lastLoginAt，保留管理员对 role / status 的调整。
 * @param {{usercode:string, username?:string, orgname?:string}} info 4A getUserInfo 返回
 */
export async function upsertSsoUser({ usercode, username, orgname }) {
  const displayName = (username && String(username).trim()) || usercode;
  const orgName = orgname || null;

  return db.users.upsert({
    where: { username: usercode },
    update: { displayName, orgName, lastLoginAt: new Date() },
    create: {
      username: usercode,
      displayName,
      orgName,
      authSource: '4a',
      role: 'user',
      status: 1,
      // 随机不可登录哈希：4A 用户永不走密码登录；非 bcrypt 串 → comparePassword 恒为 false。
      passwordHash: '4a:' + crypto.randomBytes(24).toString('hex'),
      lastLoginAt: new Date()
    }
  });
}
