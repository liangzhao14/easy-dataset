import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, JWT_EXPIRES_IN } from './constants';

const encoder = new TextEncoder();
const secretKey = encoder.encode(JWT_SECRET);

/**
 * 创建 JWT Token
 */
export async function createToken(user) {
  return await new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey);
}

/**
 * 验证 JWT Token，返回 payload
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * 哈希密码
 */
export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

/**
 * 校验密码
 */
export function comparePassword(password, hashed) {
  return bcrypt.compareSync(password, hashed);
}
