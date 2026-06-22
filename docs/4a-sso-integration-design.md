# Easy Dataset 接入中广核 4A 统一认证 — 设计与改造清单

> 状态：设计稿（凭证未到位，先搭框架）
> 适用范围：本 fork 的 Web/Docker 内网部署形态
> 参考手册：`接入中广核4A/` 下三份文档（BS架构接入指南 / 微服务调用手册 / 配置参数申请流程）

---

## 1. 背景与目标

把现有的「本地用户名密码 + 自签 JWT」认证，前置一层中广核 **4A 统一身份认证（OAuth 2.0 授权码流程）**，使员工用 4A 单点登录进入 Easy Dataset。

4A 只负责「认人」（确认是哪个工号）；认完之后**继续签发本项目现有的 JWT**，下游 `withAuth` 鉴权、项目角色模型、操作审计、监控看板**全部不动**。改动集中在「登录入口」这一层。

## 2. 决策记录（已与维护者确认）

| 编号 | 决策 | 选择 |
|---|---|---|
| D-1 | 登录形态 | **4A 为唯一入口**，未登录自动跳 4A；保留一个隐藏的本地超管后门应急 |
| D-2 | 首次登录建号 | **自动建号**：按工号创建本地账号，默认全局角色 `user`、**无任何项目权限**，等管理员/Owner 再授权 |
| D-3 | 本次范围 | 凭证未到，**先搭代码框架 + `.env` 模板 + 申请 checklist**，密钥到位后联调测试环境 |
| D-4 | 身份映射键 | 本地 `Users.username` = 4A `usercode`（工号）；`displayName` = 4A `username`（姓名） |
| D-5 | 会话机制 | 4A 回调成功后签发本项目 JWT，同时写入 **httpOnly Cookie**（供页面级强制拦截）+ 返回前端（供 API 的 Bearer 调用） |

## 3. 现状梳理（已核对代码）

- **签发**：`lib/auth/index.js::createToken(user)` 用 `jose` HS256 签 `{ userId, username, role }`，有效期 `JWT_EXPIRES_IN`（默认 7d）。
- **登录**：`app/api/auth/login/route.js` — 本地用户名密码 + bcrypt + 内存级失败锁定。
- **鉴权**：`lib/auth/middleware.js::withAuth` 从 **Authorization: Bearer** 头取 token（不是 Cookie），查 `Users`（要求 `status===1`），再做 admin/项目角色检查。
- **页面拦截**：根 `middleware.js` **只加安全响应头、不做登录拦截**（`matcher` 还排除了 `/api`）；未登录跳转目前由前端 `lib/auth-provider.js` 客户端完成。
- **数据模型**：`Users.username @unique`、`displayName` 必填、`passwordHash` **非空**、`role` 默认 `user`、`status` 默认 1。

> 关键约束：当前 token 走 **localStorage + Bearer 头**，Next.js 中间件读不到 localStorage。要实现"未登录请求服务端强制跳 4A"，必须额外把 JWT 落到 **httpOnly Cookie**（见 D-5 / §6.5）。

## 4. 总体方案

### 4.1 登录时序

```
浏览器访问任意页面
  └─ 根 middleware 检查会话 Cookie
        └─ 无 → 302 /api/auth/4a/login
                    └─ 生成 state(写短时 Cookie) → 302 到 4A authorize(login_url)
4A 登录页 → 用户登录 → 302 回调 /api/auth/4a/callback?code=xxx&state=xxx
  └─ 校验 state
  └─ ② 换 token：POST 中台 getOauth2Token(带 signInfo 头)        → { access_token }
  └─ ③ 取用户：POST 中台 getOauth2UserInfo(带 signInfo 头)        → { usercode, username, userorg, orgname }
  └─ 按 usercode 查/建本地 Users（自动建号，默认 user / 无项目权限）
  └─ 若 status!==1 → 展示"账号已禁用"页（不跳回 4A，遵循手册 4.2.4 注意事项）
  └─ createToken(user) → 写 httpOnly Cookie + 重定向到 /
```

### 4.2 双重鉴权（接入难点，务必记牢）

| 步骤 | 打哪台 | 鉴权 |
|---|---|---|
| ① 取授权码 `getOauth2Authorize` | **4A**（uap…） | 仅 OAuth 参数（浏览器 302） |
| ② 换 token `getOauth2Token` | **中台网关**（aepgw…） | OAuth `client_secret` **+ 中台 signInfo 请求头** |
| ③ 取用户 `getOauth2UserInfo` | **中台网关** | `client_id` **+ 中台 signInfo 请求头** |
| 登出 `userLogout` | **中台网关** | `client_id` **+ 中台 signInfo 请求头** |

中台请求头（来自手册 §3.4）：
```
requestId, version, appId, appMethod, timestamp, format,
signInfo, appKey, appCode, tenantId, appIdParam
signInfo = MD5(version + appKey + appMethod + timestamp + format + appSecret)   // 小写 hex
```
`appMethod` = 当次调用的端点路径（如 `/authcenter/getOauth2Token`、`/authcenter/getOauth2UserInfo`）。Node 直接用 `crypto` 实现 MD5，**不需要那套 Java/.Net SDK**。

## 5. 数据模型改动（最小）

`prisma/schema.prisma` 的 `Users` 增加 2 个安全字段（`db:push` 非破坏性）：

```prisma
model Users {
  // ...现有字段...
  authSource String  @default("local")   // 'local' | '4a'，区分来源，重置密码等流程跳过 4a 用户
  orgName    String?                       // 4A 机构名称(orgname)，给监控/标注归属做上下文
}
```

- SSO 用户的 `passwordHash` 写一个**随机不可登录的哈希**（字段非空，但永不用于密码校验）。
- 映射：`username = usercode`、`displayName = username(姓名)`、`orgName = orgname`、`authSource = '4a'`、`role = 'user'`、`status = 1`，**不创建任何 `ProjectMembers`**。
- 同工号再次登录 → 查到即复用（视为同一身份），仅刷新 `lastLoginAt`/`displayName`/`orgName`。

> 改完执行 `pnpm db:push`；Electron 打包另需 `pnpm db:template`（本接入面向 Web/Docker，可暂不管）。

## 6. 后端改动清单

### 6.1 新增配置模块 `lib/auth/4a/config.js`
集中读取所有 `CGN_4A_*` 环境变量（见 §8），并提供 `is4AEnabled()`。

### 6.2 新增签名工具 `lib/auth/4a/sign.js`
```js
// signInfo = md5(version + appKey + appMethod + timestamp + format + appSecret)
buildGatewayHeaders(appMethod) → { requestId, version, appId, appMethod, timestamp, format, signInfo, appKey, appCode, tenantId, appIdParam }
```

### 6.3 新增 4A 客户端 `lib/auth/4a/client.js`
- `getToken(code)` → ② 换 token（带中台头 + 自签证书 agent）
- `getUserInfo(accessToken)` → ③ 取用户
- `logout(accessToken)` → 单点登出
- 内置 `https.Agent`：优先用 `CGN_4A_CA_CERT` 指定的内网 CA；`CGN_4A_INSECURE_TLS=true` 时 `rejectUnauthorized:false`（**仅测试**）。

### 6.4 新增路由
- `GET app/api/auth/4a/login/route.js`：生成 `state`（写短时 httpOnly Cookie）→ 拼 `response_type/client_id/redirect_uri(URLEncode!)/state` → 302 到 `CGN_4A_AUTHORIZE_URL`。
- `GET app/api/auth/4a/callback/route.js`：校验 `state` → `getToken` → `getUserInfo` → 自动建号/复用 → `createToken` → 写会话 Cookie → 302 到 `returnTo`(默认 `/`)。
  - 用户信息拿到但本地 `status!==1`：渲染/重定向到"账号已禁用"提示页，**不要**直接调 `userLogout` 跳回登录（手册 4.2.4 明确要求）。

### 6.5 页面级强制拦截（满足手册自检 4.3.1）
改 `middleware.js`：对页面路由（非 `/api`、非静态资源、非 `/login`、非 `/api/auth/4a/*`）检查会话 Cookie，无有效会话 → 302 到 `/api/auth/4a/login?returnTo=<原始路径>`。这样不存在"无效地址直接 404 而没跳 4A"的情况。

### 6.6 `withAuth` 兼容 Cookie（可选增强）
`lib/auth/middleware.js` 取 token 时，除 `Authorization: Bearer` 外，回退读会话 Cookie，便于服务端渲染/直链场景。前端 API 调用仍用 Bearer，改动向后兼容。

### 6.7 本地后门
- 保留 `app/api/auth/login`（即后门），但默认从登录 UI 隐藏；由 `CGN_LOCAL_LOGIN_ENABLED` 控制是否启用，超管走隐藏入口 `/login?local=1`。
- 登出 `app/api/auth/logout`：清本地会话 Cookie + localStorage；按需调 4A `userLogout`（"切换用户"场景必须先登出 4A 会话，否则 SSO 会自动复登同一人）。

### 6.8 管理员来源与权限引导（务必）

**默认进来的身份**（重申 D-2）：4A 首次登录自动建号 → 全局 `user` + **零项目权限**（不建任何 `ProjectMembers`、非任何项目 owner）。结果是登录后看到**空应用**，必须等授权——这是有意的最小权限默认。

**管理员不从 4A 来**，信任根是本地超管后门（D-1）。引导链：

1. **超管引导**：`app/api/auth/init`（首次启动初始化，见 `INITIALIZATION.md`）创建一个**本地账号** `role='admin'`、`authSource='local'`，**不走 4A**，走隐藏后门 `/login?local=1` 登录。
2. **给 4A 用户授权**（能力均已存在，无需新开发）：
   - 提升全局角色：`PUT /api/admin/users/[userId]` 可把 4A 用户从 `user` 提为 `admin`，且有「最后一个 admin 不准降级/禁用」保护（`app/api/admin/users/[userId]/route.js`）。
   - 分项目权限：admin/owner 通过项目成员管理加成员并指定 owner/editor/annotator/viewer。
3. 闭环：本地超管（后门）→ 把指定 4A 工号提成 admin 或分项目角色 → 之后这些 admin 也能走 4A 正常登录管理。

**admin 是否也能从 4A 自动产生 —— 已定：方案 A。**
- ✅ 方案 A（采用）：admin 永远靠本地后门账号引导，再手动提升 4A 用户。简单、安全；4A 用户一律默认 `user`。
- 方案 B（暂不做，留作未来便利）：加工号白名单 `CGN_4A_ADMIN_USERCODES`，名单内工号首次 4A 登录直接建成 `admin`。省去后门，但「谁是管理员」被配进 `.env`。待真有"管理员不想用后门"诉求再启用。

**⚠️ 锁死防护（硬规则）**：在**至少有一个可达的 admin 身份之前，绝不允许关闭后门**（`CGN_LOCAL_LOGIN_ENABLED=false`）。否则若此时还没有任何 4A 用户被提升为 admin，将**无人能进管理后台**，彻底锁死。落地建议：后门开关在启动时校验——要关后门，必须已存在至少一个 `role='admin'` 且可登录的账号（本地 admin 或已提升的 4A 工号）。

## 7. 前端改动（最小）

- 登录页 `app/login`：默认只显示「使用 4A 登录」按钮（指向 `/api/auth/4a/login`）；`?local=1` 时显示原密码表单（后门）。
- `lib/auth-provider.js`：401/无会话时跳转目标从 `/login` 改为 `/api/auth/4a/login`（保留 `?local=1` 例外）。
- 回调成功后前端从 `/api/auth/me` 拉用户信息并写入 store/localStorage（token 也可由回调以一次性方式回传）。

## 8. `.env` 模板（待凭证到位填写）

```bash
# === 4A 开关 ===
CGN_4A_ENABLED=true
CGN_LOCAL_LOGIN_ENABLED=true          # 保留本地超管后门

# === 4A OAuth 应用凭证（向 4A 项目组注册后获得）===
CGN_4A_CLIENT_ID=
CGN_4A_CLIENT_SECRET=
CGN_4A_REDIRECT_URI=https://<部署域名>/api/auth/4a/callback   # 必须与注册值大小写完全一致，且不含 '#'

# === 端点地址（默认测试环境，生产换 uap / aepgw 无 -t）===
CGN_4A_AUTHORIZE_URL=https://uap-t.cgnpc.com.cn/authcenter/getOauth2Authorize
CGN_4A_TOKEN_URL=https://aepgw-t.gnpjvc.cgnpc.com.cn/authcenter/getOauth2Token
CGN_4A_USERINFO_URL=https://aepgw-t.gnpjvc.cgnpc.com.cn/authcenter/getOauth2UserInfo
CGN_4A_LOGOUT_URL=https://aepgw-t.gnpjvc.cgnpc.com.cn/authcenter/userLogout
CGN_4A_HTTP_METHOD=POST               # token/userinfo 用 GET 或 POST

# === 中台网关凭证（CSP 服务中心申请 4A 认证服务后获得）===
CGN_4A_APP_KEY=
CGN_4A_APP_SECRET=
CGN_4A_APP_ID=
CGN_4A_APP_CODE=
CGN_4A_TENANT_ID=1
CGN_4A_APP_ID_PARAM=                  # ⚠️ 待确认：换 token 头是否必须（见 §10）
CGN_4A_VERSION=1.0
CGN_4A_FORMAT=json

# === 内网自签证书 ===
CGN_4A_CA_CERT=/etc/easydataset/cgn-4a-ca.pem   # 推荐：pin 内网 CA
CGN_4A_INSECURE_TLS=false             # 仅测试可临时 true
```

## 9. 安全与手册自检对照

| 手册自检项 (§4.3) | 本方案落点 |
|---|---|
| 4.3.1 拦截所有未登录请求跳 4A | §6.5 服务端 middleware 强制跳转，无 404 漏网 |
| 4.3.2 4A 请求由后端发起 | ②③④ 全在 Next.js API route（后端 Node）发起，前端不接触 |
| 4.3.3 敏感信息后端保存 | `client_secret/appSecret` 仅在 `.env` + 后端，绝不返回前端 |
| 4.3.4 referer 校验 | 部署域名需在 4A 注册为应用地址，否则 403（见 §10 checklist） |
| 复用现有安全基线 | `state` 防 CSRF、JWT 签名、`status` 禁用校验、登录失败锁定（后门）保持 |

## 10. 外部依赖与待确认项（联调前必须钉死）

**待向 4A 负责人确认（王伟东 P624247 / 贺军 P633932）：**
1. **`appIdParam` 是否为换 token/取用户的必传头**——手册 §3.4 原始样例里有，但 `oauthcfg.properties` 模板没列。缺它可能 401。
2. **`timestamp` 格式**——BS 指南换 token 样例用 **epoch 秒**（`1593668975`），微服务手册的 signInfo 又写 `yyyy-MM-dd HH:mm:ss`。**两文档不一致**，且 signInfo 必须与请求头里送的 timestamp 字符串完全一致。默认按 epoch 秒，需确认。
3. **`tenantId` 取值**——样例为 `1`，确认本应用是否也是 1。
4. **内网 CA 证书**——拿到 4A/中台的内网 CA，避免线上用 `INSECURE_TLS`。

**线下申请流程（参考《配置参数申请流程》，凭证从这里来）：**
- [ ] IDP 立项 / 维护系统（需「运维工程师」权限，找 IDP 工程师扈志芳 P633802 授权）
- [ ] CSP「申请中心 → 应用注册申请」→ 拿审批
- [ ] CSP「服务中心」选 **4A 认证服务** 加购物车 → 选自己系统 → 提交审批
- [ ] `https://csp/order` 领**测试环境**密钥（client_id/secret + appKey/appSecret/appId/appCode/appIdParam）
- [ ] 邮件向 4A 项目组（`4a@gnpjvc.com.cn`）注册应用信息（应用地址、**应用重定向地址**=我们的 callback、安全口令等）
- [ ] 提供部署域名给 4A 做 **referer 注册**（否则 403）
- [ ] 测试跑通后发邮件申请**生产**密钥，替换测试值

## 11. 实施步骤（密钥到位后按序执行，每步带验证）

1. schema 加 `authSource/orgName` → `pnpm db:push` → **验证**：Prisma Studio 看到新列。
2. `lib/auth/4a/{config,sign,client}.js` → **验证**：单测/脚本对一组已知值算 signInfo，与 4A 给的样例核对一致。
3. `/api/auth/4a/login` + `/api/auth/4a/callback` → **验证**：测试环境点「4A 登录」能 302 到 uap-t 并带回 code。
4. 自动建号 + 签 JWT + 写 Cookie → **验证**：首次登录后 `Users` 出现工号账号、`role=user`、无 `ProjectMembers`；能进首页。
5. `middleware.js` 强制拦截 + 前端登录页改造 → **验证**：未登录直接访问任意页面被跳到 4A；后门 `/login?local=1` 仍可超管登录。
6. 登出（含可选 4A SLO）→ **验证**：登出后再访问被重新拦截到 4A。
7. 自检对照 §9 全过 → 申请生产密钥切换。

**整体成功标准**：测试环境下，一名 4A 员工首次访问 → 自动跳 4A → 登录 → 回到 Easy Dataset 且已是登录态（工号账号已自动创建、默认无项目权限）；管理员授权项目后该用户可见对应项目；超管仍可用后门登录。

## 12. 风险

- 内网联调依赖中广核环境与审批节奏，本地无法独测 4A（只能 mock）。
- 自签证书若用 `INSECURE_TLS` 上线会有中间人风险——务必拿到 CA 证书。
- `appIdParam`/`timestamp` 格式两处未明确，是最可能导致 401 的坑，联调第一步先打通 signInfo。
- 引入 Cookie 会话是对现有「纯 Bearer」模型的扩展，需回归测试现有 API 鉴权未受影响。

## 13. 实现注意事项 / 已知坑（写代码前必读）

> 这些是 §1–§12 之外、照设计直接落码会真正撞上的工程坑。前 5 条不处理会出 bug 或引入安全回退。

### 13.1 【必修】middleware 跑在 Edge Runtime，碰不到 Prisma / Node API
`middleware.js` 默认是 **Edge Runtime**，不是 Node。现有 `getCurrentUser` 里的 `db.users.findUnique`（Prisma）在 Edge **会直接崩**。所以 §6.5 的页面网关只能做一件事：用 `jose` 校验 JWT **签名**（jose 兼容 edge）。

- 网关里**绝不能**查库、**不能** import `lib/auth/4a/client.js`（含 `https.Agent`/`crypto`）、也不能 import 任何间接拉进 Prisma / bcryptjs 的模块。
- 副作用（可接受）：仅验签 ⇒ 会话期内被禁用（`status=0`）的用户，**页面壳仍能加载**到 token 过期；但所有 API 走 `withAuth` 仍查库挡住，数据无法越权。

### 13.2 【必修】Cookie 会话 + §6.6 会给写接口引回 CSRF
现有 API 是 **Bearer-only**，天然免疫 CSRF。一旦让 `withAuth` 回退读 Cookie，浏览器跨站请求会自动带 Cookie ⇒ 刚补全的 79 个写接口集体出现 CSRF 风险。**只提 httpOnly 不够，关键在 `SameSite`**。

- **决策**：Cookie **只供 middleware 页面网关**使用；`withAuth` 保持 Bearer-only（即 **§6.6 不做**，或仅对 GET 放行）。
- 会话 Cookie 一律 `HttpOnly; Secure; SameSite=Lax`。

### 13.3 【必修】token 交接：302 重定向后 SPA 拿不到 token
回调结尾是 `302 → /`，重定向**无 JSON body**，而前端靠从 localStorage 读 token 注入 Bearer。需明确机制：

```
回调写 httpOnly 会话 Cookie → 302 到 /（或 /auth/complete）
  → 前端调 /api/auth/me（让它接受 Cookie 鉴权，并把 token 一并返回）
  → 前端把 token 存 localStorage，之后照旧走 Bearer
```

页面网关用 Cookie、API 仍用 Bearer，两套互不干扰，也不触发 13.2 的 CSRF。（把 JWT 暴露给 JS 不比现状更差——现在就是 localStorage 存 Bearer。）

### 13.4 【必修】`state` Cookie 必须 `SameSite=Lax`，不能 Strict
从 4A 域 302 回 `/api/auth/4a/callback` 是**跨站顶层导航**，`SameSite=Strict` 的 Cookie 在这一跳**不会发送** ⇒ state 校验必然失败、登录跑不通。state 短时 Cookie 必须 `SameSite=Lax`（或 `None; Secure`）。

### 13.5 【必修】`returnTo` 开放重定向
回调后跳 `returnTo` 前必须校验**同源相对路径**：以 `/` 开头且不是 `//`、`/\`。否则 `returnTo=//evil.com` 即 open redirect。

### 13.6 【建议】其余该想到的
| 项 | 说明 |
|---|---|
| 自动建号竞态 | 同工号并发回调（双开/双击）会撞 `username @unique`。用 upsert 或"建失败即重查"兜底，别让第二个回调 500。 |
| 4A 关闭时回退 | `CGN_4A_ENABLED=false` 时 middleware 不能再跳 `/api/auth/4a/login`，否则无 4A 环境本地打不开；`is4AEnabled()` 要在网关逻辑里短路。 |
| Secure Cookie 依赖 HTTPS | 内网若 http 部署，`Secure` Cookie 不发送、登录态丢失。`redirect_uri` 既是 https，部署须 https。 |
| JWT 7d 与 4A 会话解耦 | 4A 中心化登出后本地 JWT 仍有效到 7 天。v1 可接受，建议给 SSO 用户缩短 `JWT_EXPIRES_IN` 或记为已知限制。 |
| displayName 兜底 | 4A 姓名为空时 `displayName` 必填会插库失败，回退用 `usercode`。 |
| 登录页/错误页白名单 | middleware 网关需放行 `/login`、`/api/auth/4a/*`、"账号已禁用"提示页，避免重定向死循环。 |
