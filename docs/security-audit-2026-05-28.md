# Easy Dataset 安全审计报告

**审计日期：** 2026-05-28
**审计范围：** 43 个定制化文件（一期-四期全部代码）
**审计类型：** 代码审查 + 自动化扫描

---

## 一、审计概览

| 严重程度 | 数量 | 说明 |
|----------|------|------|
| 🔴 CRITICAL | 0 | 无 |
| 🟠 HIGH | 1 | 登录接口无暴力破解防护 |
| 🟡 MEDIUM | 2 | 缺少安全响应头、项目创建使用 spread operator |
| 🔵 LOW | 4 | 输入长度限制、Token 提取、竞态条件、密码策略 |
| **总计** | **7** | |

---

## 二、详细发现

### 🔴 CRITICAL — 无

所有路由均使用 `withAuth` 包裹，权限校验完整。Prisma ORM 无原始 SQL 注入风险。无 XSS（dangerouslySetInnerHTML 仅在 Next.js 内置 404 页面使用）。

---

### 🟠 HIGH — 1 个

#### [H-001] 登录接口无暴力破解防护

- **文件：** `app/api/auth/login/route.js`
- **风险：** POST /api/auth/login 无任何速率限制，攻击者可无限尝试密码
- **影响：** 弱密码账户可能在数分钟内被攻破
- **修复建议：** 添加登录失败计数（内存或数据库），连续失败 5 次后锁定 15 分钟；或使用 IP 级速率限制

---

### 🟡 MEDIUM — 2 个

#### [M-001] 缺少安全响应头

- **文件：** `next.config.js`
- **风险：** 未配置 CSP (Content-Security-Policy)、X-Frame-Options、X-Content-Type-Options
- **影响：** 增加 XSS 和 clickjacking 攻击面
- **修复建议：** 在 next.config.js 中添加 headers() 配置：
```javascript
async headers() {
  return [{ source: '/(.*)', headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
  ]}];
}
```

#### [M-002] 项目创建使用 spread operator

- **文件：** `app/api/projects/route.js` line 29
- **风险：** `...projectData` 允许客户端传入额外字段，虽然后续显式覆盖了 ownerId/projectType/visibility，但仍存在一定过量赋值风险
- **影响：** 低 — 主要敏感字段已被硬编码覆盖
- **修复建议：** 显式提取所需字段而非使用 spread：
```javascript
const { name, description, reuseConfigFrom, projectType, visibility } = projectData;
```

---

### 🔵 LOW — 4 个

#### [L-001] 输入字段缺少长度限制

- **文件：** `app/api/projects/route.js`, `app/api/admin/users/route.js`
- **风险：** 用户名、项目名、描述等字段无最大长度限制
- **影响：** 可导致数据库截断或轻微 DoS
- **修复建议：** 添加字段长度校验（如项目名 ≤ 100 字符，用户名 ≤ 50 字符）

#### [L-002] Token 提取未 trim 空白字符

- **文件：** `lib/auth/middleware.js` line 9
- **风险：** `authHeader.slice(7)` 保留前导空格，极少数客户端实现可能失败
- **影响：** 低 — 不会导致安全问题，仅可能影响兼容性
- **修复建议：** `.slice(7).trim()`

#### [L-003] 初始化管理员竞态条件

- **文件：** `app/api/auth/init/route.js`
- **风险：** `countUsers()` 和 `createUser()` 之间无原子保护
- **影响：** 低 — SQLite 单文件写入天然串行化，实际竞态几率极低
- **修复建议：** 使用 Prisma 事务或数据库 UNIQUE 约束

#### [L-004] 密码最小长度可加强

- **文件：** `app/api/auth/change-password/route.js`, `app/api/auth/init/route.js`
- **风险：** 密码最小长度 6 位，符合基本标准但可以更强
- **影响：** 低
- **修复建议：** 升级到 8 位并建议包含大小写字母和数字

---

## 三、安全优势

以下方面通过审计，确认无已知漏洞：

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| SQL 注入 | ✅ 安全 | 全部使用 Prisma ORM，无 raw query |
| XSS | ✅ 安全 | 无 dangerouslySetInnerHTML 使用 |
| CSRF | ✅ 安全 | JWT Bearer token 天然防御 CSRF |
| 硬编码密钥 | ✅ 安全 | 仅 constants.js 中有默认值并打印警告 |
| 权限隔离 | ✅ 安全 | 所有 API 有 withAuth，管理员/普通用户正确隔离 |
| 示范项目只读 | ✅ 安全 | Demo 写操作由中间件拦截 |
| 操作日志 | ✅ 安全 | 不记录密码/API Key 等敏感信息 |
| 密码存储 | ✅ 安全 | bcryptjs, saltRounds=10 |
| IDOR | ✅ 安全 | 项目操作均校验 ownerId 或成员关系 |

---

## 四、优先级修复建议

| 优先级 | 编号 | 问题 | 工作量 |
|--------|------|------|--------|
| P0 | H-001 | 登录暴力破解防护 | 30 min |
| P1 | M-001 | 安全响应头 | 15 min |
| P2 | M-002 | Spread operator 改显式提取 | 10 min |
| P3 | L-001 | 输入字段长度限制 | 20 min |

---

## 五、结论

**系统整体安全状况良好。** 核心安全机制（认证、授权、密码哈希、审计日志）实现正确。无 SQL 注入、XSS、CSRF、硬编码密钥或 IDOR 漏洞。1 个 HIGH 级问题（登录速率限制）建议尽快修复。
