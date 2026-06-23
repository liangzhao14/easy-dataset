# 4A SSO 接入 — 开发计划 todo list

> 设计依据：`docs/4a-sso-integration-design.md`（§5 数据模型 / §6 后端 / §7 前端 / §11 步骤 / §13 已知坑 / §6.8 管理员引导）
> 决策：管理员来源 = 方案 A（本地后门超管引导，4A 用户默认 `user`）
> 状态：凭证未到，**P0–P2 + P4 可现在零密钥开发**，P3/P6/P7 真连 4A 需测试密钥

## 并行说明（哪些现在就能做）
- ✅ **零密钥可开发**：P1 数据模型、P2 4A 核心库、P4 网关+token交接、P5 前端、P6 登出骨架 —— 约占一半工作量、零返工风险
- ⚠️ **需测试密钥才能验证**：P3 回调真连、P7 联调、P8 生产切换
- 🔑 **线下并行催凭证**：CSP 应用注册 → 领测试密钥 → 邮件 4a@gnpjvc.com.cn 注册 callback/referer（设计 §10）

---

## P0 联调前必须钉死（找王伟东 P624247 / 贺军 P633932；原文核对见 /tmp/4a_*.md，推荐默认见设计 §4.3）
- [ ] 0.1 **`appMethod` 该填什么（最关键）**：BS 样例请求是 getOauth2Token 但 appMethod 头填 getOriginalForSign（自相矛盾）。推荐"当次端点路径"，错则签名直接 401（§10.1）
- [ ] 0.2 `appIdParam` 是否必传：BS 样例(`4a_bs.md:307`)有、推荐带上；微服务手册是截图取不到（§10.2）
- [ ] 0.3 `timestamp` 格式：epoch 秒(推荐) vs `yyyy-MM-dd HH:mm:ss`，两文档冲突且须与 signInfo 内一致（§10.3）
- [ ] 0.4 `version` 取值：`1`(推荐,OAuth线) vs `v1.0`(微服务线)，进 signInfo（§10.4）
- [ ] 0.5 `tenantId` 本应用取值（样例为 1）（§10.5）
- [ ] 0.6 索取内网 CA 证书，避免上线用 INSECURE_TLS（§10.6）

## P1 数据模型（零密钥）✅
- [x] 1.1 `prisma/schema.prisma` Users 加 `authSource String @default("local")` + `orgName String?`
      → **已验证**：`prisma db push` 成功；PRAGMA 见 authSource(NOT NULL default 'local')/orgName(nullable)；存量行默认 local
- [ ] 1.2 注意 Electron 打包另需 `pnpm db:template`（本接入面向 Web/Docker，暂不做）

## P2 4A 核心库（零密钥可写+单测）
- [x] 2.1 `lib/auth/4a/config.js`：集中读 `CGN_4A_*`，导出 `fourAConfig` + `is4AEnabled()`
      → **已验证**：未配端点时 `is4AEnabled()===false`、不抛错；语法 --check OK
- [x] 2.2 `lib/auth/4a/sign.js`：`buildGatewayHeaders/computeSignInfo/buildTimestamp`；timestamp 按 `CGN_4A_TIMESTAMP_FORMAT` 双模式
      → **已验证**：`scripts/check-4a-signinfo.mjs` 跑通，产出 32位小写hex、拼接顺序正确（联调时与 4A 样例核对真值）
- [x] 2.3 `lib/auth/4a/client.js`：`getToken/getUserInfo/logout`（参数依 BS 指南接口表）+ `https.Agent`（CA / INSECURE_TLS）
      → **已验证**：语法 --check OK；接口参数 grant_type/code/redirect_uri、access_token/client_id 已对齐手册
      → ⚠️ **坑 13.1**：Node-only（https/fs），**绝不能被 middleware import**
      → 注：业务参数默认走 query string、appMethod 取 URL pathname；form/json 与 appMethod 固定值待 P0/联调确认

## P3 路由（骨架完成 ✅，真连需密钥）
新增辅助：`lib/auth/cookies.js`（会话/state cookie 属性 + safeReturnTo，edge 安全）、`lib/auth/4a/user.js`（upsertSsoUser 建号）
- [x] 3.1 `app/api/auth/4a/login/route.js` GET：`is4AEnabled` 短路；生成 `state` 写短时 httpOnly Cookie（**SameSite=Lax** 坑 13.4）；拼 authorize URL（redirect_uri URLEncode）；带 `returnTo`；302 到 `CGN_4A_AUTHORIZE_URL`
      → **已验证(dev真跑)**：302 到 authorize 且带 state；`set-cookie: ed_4a_state; Max-Age=600; HttpOnly; SameSite=lax`
- [x] 3.2 `app/api/auth/4a/callback/route.js` GET：state 校验 + returnTo 同源校验(13.5) + upsert 建号(13.6,displayName兜底,authSource=4a/role=user,不建 ProjectMembers) + status≠1 提示不调 userLogout + createToken 写会话 Cookie(HttpOnly;Secure;SameSite=Lax 13.2) → 302 returnTo
      → **已验证(dev真跑)**：state 失配 → 302 `/login?error=...` 且清 state cookie
      → ⏳ **待密钥**：getToken/getUserInfo 真连 + 建号→写会话整条链路（P7 联调）

## P4 会话网关 + token 交接（零密钥）✅
- [x] 4.1 `middleware.js`：**仅 jose 验签会话 Cookie，不查库、不 import Prisma/Node/4a-client**（坑 13.1）；无效→302 `/api/auth/4a/login?returnTo=...`；白名单 `/login`、`/init`（`/api`+静态已被 matcher 排除）；`is4AEnabled()===false` 短路放行（坑 13.6）
      → **已验证(dev真跑)**：无会话 /projects→302 4a login(returnTo=%2Fprojects)；/login→200 放行；有效会话 cookie→404(放行,jose 验签在 Edge 跑通)；dev 日志无 Node 模块告警
- [x] 4.2 `app/api/auth/me/route.js`：除 Bearer 外支持**会话 Cookie 鉴权**，Cookie 场景**回传 token**（坑 13.3）
      → **已验证(dev真跑)**：带会话 cookie→200 返回 user(lisi)+token；无凭证→401
- [x] 4.3 `withAuth` **保持 Bearer-only**（§6.6 不做，防 CSRF 回退 坑 13.2）
      → **已确认(代码未动)**：getCurrentUser 仍只读 Authorization 头(lib/auth/middleware.js:6-9)，cookie 不能鉴权 withAuth 接口

## P5 前端（零密钥）
- [ ] 5.1 `components/auth/LoginPage`：默认仅「使用 4A 登录」按钮→`/api/auth/4a/login`；`?local=1` 显示原密码表单（后门）
      → **验证**：`/login` 只见 4A 按钮；`/login?local=1` 见密码表单
- [ ] 5.2 `lib/auth-provider.js`：401/无会话跳转 `/login`→`/api/auth/4a/login`（保留 `?local=1` 例外）；回调回来后从 `/api/auth/me` 取 token 存 localStorage（坑 13.3）
      → **验证**：token 过期/401 自动跳 4A；后门路径不被劫持
- [ ] 5.3（可选）导航/账号展示：authSource=4a 用户展示 orgName

## P6 登出（骨架零密钥，SLO 需密钥）
- [ ] 6.1 `app/api/auth/logout`：清会话 Cookie + 前端清 localStorage；按 `CGN_4A_LOGOUT_URL` 调 `userLogout`（"切换用户"必须，否则 SSO 自动复登）
      → **验证**：登出后再访问被重新拦截到 4A

## P7 联调 + 自检（需测试密钥）
- [ ] 7.1 填 `.env` 测试值；先打通 signInfo（P0 的 timestamp/appIdParam 确认后）
- [ ] 7.2 §11 步骤 3–7 全程跑通；§9 安全自检 4.3.1–4.3.4 逐条过
- [ ] 7.3 锁死防护（§6.8）：验证"有可达 admin 前不能关后门"——`CGN_LOCAL_LOGIN_ENABLED=false` 启动校验
- [ ] 7.4 回归：现有 Bearer API 鉴权未受影响（坑 13.2）；本地后门超管 `/login?local=1` 仍可登录并提升 4A 用户为 admin

## P8 生产切换
- [ ] 8.1 申请生产密钥替换测试值；端点换 `uap`/`aepgw`（去 `-t`）；redirect_uri 换生产域名并在 4A 完成 referer 注册
- [ ] 8.2 装内网 CA、`INSECURE_TLS=false`；Docker 部署必须 HTTPS（Secure Cookie 依赖 坑 13.6）

---

## Review（完成后回填）
- 实际改动文件清单：
- 偏离设计之处：
- 遗留/已知限制：
