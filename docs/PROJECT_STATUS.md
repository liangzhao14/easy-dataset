# Easy Dataset Fork — 项目进展与下一步

> 最后更新：2026-06-24（由 Claude 维护的工作快照，供下次对话快速接续）
> 本 fork = 上游 Easy Dataset（单机数据集工具）+ 本仓库叠加的**账号认证 / 团队协作 / 权限隔离 / 操作审计 / 监控看板 / Docker 部署**，当前正在接入**中广核 4A 统一认证（SSO）**并完成了登录页重设计。

---

## 一、当前两条主线

### 1. 4A 统一认证接入（进行中，唯一阻塞 = 测试密钥未到）

**目标**：登录入口前置一层中广核 4A（OAuth2 授权码）。4A 只认人（工号），认完仍签发本项目现有 JWT，下游 `withAuth`/权限/审计**全不动**，改动压在登录入口。管理员走方案 A（本地后门做信任根，4A 用户默认 `user`）。

**进度（零密钥框架 P1–P6 全部完成、端到端验证、已在 main）**：

| 阶段 | 内容 | 状态 |
|---|---|---|
| 设计 | `docs/4a-sso-integration-design.md`（含 §4.3 推荐默认、§6.8 管理员引导、§13 五个必修坑、§10 待确认项） | ✅ |
| P0 | signInfo 参数**已据 BS 指南锁定**（见下） | ✅ |
| P1 | schema 加 `authSource`/`orgName` | ✅ |
| P2 | `lib/auth/4a/{config,sign,client}.js` + `scripts/check-4a-signinfo.mjs` | ✅ |
| P3 | `app/api/auth/4a/{login,callback}/route.js` + `lib/auth/cookies.js` + `lib/auth/4a/user.js` | ✅ |
| P4 | `middleware.js` 页面网关（Edge 仅 jose 验签）+ `/api/auth/me` 取 token + withAuth 保持 Bearer-only | ✅ |
| P5 | 登录页 4A 分支 + `lib/auth-provider.js` 会话引导（cookie→localStorage）+ `app/api/auth/config` | ✅ |
| P5.3 | 导航栏为 4A 用户显示 orgName | ✅ |
| P6 | 登出清会话 Cookie + 可选 4A SLO；本地后门登录也写会话 Cookie | ✅ |
| **P7** | **真连联调（getToken/getUserInfo/userLogout、signInfo 对真值）** | ⏳ **卡测试密钥** |
| **P8** | **生产切换（端点去 -t、域名 referer、内网 CA、进 Docker 镜像配 env）** | ⏳ **卡测试密钥** |

**P0 已锁定的 signInfo 参数（2026-06-23 据《BS 架构接入指南》getOauth2Token 样例）**：
- `appMethod` = **固定值 `/authcenter/getOriginalForSign`**（不是业务端点！原实现取 URL pathname 是错的，已改为 `CGN_4A_APP_METHOD`）
- `version=1`、`timestamp`=epoch 秒、`appIdParam` 必传、`tenantId=1`、`format=json`
- signInfo 公式：`md5(version + appKey + appMethod + timestamp + format + appSecret)` 小写 hex

**4A 接入新增/改动文件**：
- 新增：`lib/auth/4a/{config,sign,client,user}.js`、`lib/auth/cookies.js`、`app/api/auth/4a/{login,callback}/route.js`、`app/api/auth/config/route.js`、`scripts/check-4a-signinfo.mjs`
- 改动：`middleware.js`、`app/api/auth/{me,login,logout}/route.js`、`prisma/schema.prisma`、`lib/auth-provider.js`、`components/auth/LoginPage.js`、`components/Navbar/ActionButtons.js`

### 2. 登录页重设计（已完成）

`components/auth/LoginPage.js` 重设计为**左右分屏浅色科技蓝**风格（参考企业级登录页）：左侧品牌插画区（蓝图网格 + 悬浮发光 logo + 柔光投影），右侧白色登录卡。柔和 periwinkle 蓝 `#6E89E9`，左上角品牌图标。

- **4A 为主入口**：`CGN_4A_ENABLED=true` 时 `/login` 显示「使用 4A 统一身份登录」按钮；
- **本地登录页保留**：`/login?local=1`（超管后门，含用户名/密码 + 记住账号），两页互有跳转链接；
- 4A 关闭时 `/login` 自动回退为本地密码页（本地部署不受影响）。
- 深色模式：暂不做（登录页固定浅色品牌门面，已与用户确认）。

---

## 二、部署（OrbStack）

**本机 Docker 运行时已从 Docker Desktop 换成 OrbStack（2026-06-23）**：
- docker CLI 在 **`~/.orbstack/bin/docker`**（裸 `docker` 不在 PATH；旧 `/usr/local/bin/docker` 已删）
- `~/.orbstack/bin/docker compose build` → `up -d` → 容器 `Up (healthy)`，bind mount 持久化，healthcheck=`/api/auth/init`
- 全流程已验证可用（含新登录页镜像）

**部署步骤**：
```bash
~/.orbstack/bin/docker compose build           # 改了源码才需重建
~/.orbstack/bin/docker compose up -d           # 起容器（端口 1717）
~/.orbstack/bin/docker compose logs -f         # 日志
~/.orbstack/bin/docker compose down            # 停并删
```

**测试账号**（仅本地 dev `prisma/db.sqlite`，gitignore）：`tester` / `Test@1234`（管理员）

**部署陷阱**：
- `.env.local` 必须有 `JWT_SECRET`（≥32 位）；无 `CGN_4A_*` 则普通本地登录，加 dummy `CGN_4A_*` 即展示 4A 登录页（**演示完记得删，否则强制 SSO 跳 dummy 失败**）。
- `restart: unless-stopped`：OrbStack/电脑重启后容器自动用当前镜像拉起、占 1717，排查先 `docker compose ps`。
- production 不热重载：改源码必须 `compose build` 重建；验证用 `next dev`。
- bind mount：改 `prisma/db.sqlite` 前先 `compose stop`。
- ⚠️ **已修的 prod-only 坑**：读运行时 env 又不用 `request` 的 route handler，生产会被 Next 静态缓存 → 必须 `export const dynamic='force-dynamic'`（`app/api/auth/config/route.js` 已加）。dev 无此缓存测不出。

---

## 三、下一步计划

### 线 A —— 你推进（线下，当前关键路径）
1. 申请 4A **测试密钥**（CSP 应用注册 → `client_id/secret` + `appKey/appSecret/appId/appCode/appIdParam`）
2. 邮件 `4a@gnpjvc.com.cn` 注册 callback 地址 + 部署域名 referer
3. 找 4A 要**内网 CA 证书**

### 线 B —— 密钥到位后我做（P7 联调，约半天～1 天）
1. 填 `.env`（参考设计 §8 / §4.3，值都已确定）
2. `CGN_4A_SAMPLE_APP_SECRET=<真secret> node scripts/check-4a-signinfo.mjs` → 复算出手册样例 `91820a135da0cafc9b278d7f0b014830` 确认算法
3. 测试环境真连：点 4A 登录 → 跳转 → 回调建号 → 进站
4. §9 安全自检 + §6.8 锁死防护（有 admin 前不关后门）
5. 回归：现有 Bearer API、本地后门不受影响

### 之后 —— P8 生产
端点换 `uap`/`aepgw`（去 `-t`）、redirect_uri 换生产域名 + referer 注册、装内网 CA 关 `INSECURE_TLS`、4A 代码进 Docker 镜像 + compose 配 `CGN_4A_*`。

### 登录页：已完成，无待办。

---

## 四、速查
- 设计文档：`docs/4a-sso-integration-design.md`
- 开发计划（可勾选）：`tasks/todo.md`
- signInfo 自测：`scripts/check-4a-signinfo.mjs`
- 4A 接入手册原件：`/Users/zhaoliang/code/接入中广核4A/`（提取文本曾放 `/tmp/4a_*.md`）
- 4A 负责人：王伟东 P624247 / 贺军 P633932
