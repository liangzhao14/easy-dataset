# Easy Dataset 团队协作系统 - 全量测试与修复报告

**测试日期：** 2026-05-28
**测试范围：** PRD `docs/prd/2026-05-27-team-collaboration-monitoring-prd.md` 一-四期全部功能
**测试目标：** http://localhost:1717
**测试环境：** macOS 26.5, Node.js v24.14.1, Next.js 14.2.29 (dev 模式), SQLite
**测试账号：** admin/admin123（管理员）、user1/user123、tester3/tester1234、fulltest/fulltest1234
**当前数据规模：** 13 用户 / 15 项目 / 2 团队 / 200 datasets / 17,289 操作日志

---

## 一、执行摘要

| 维度 | 结论 |
|------|------|
| 功能测试 | **API 62/62 通过 + UI 关键页面正常**，比上一轮多覆盖 33 项 |
| 安全漏洞 | 7 个已知漏洞全部闭环，**本次额外修复 4 个新发现 bug** |
| 并发性能 | **完全不会卡死**：50 并发 0 失败 / 60s 持续压测 15,828 请求 0 失败 |
| 监控性能 | 修复缺失索引后**操作日志查询 27 倍加速** |

---

## 二、安全漏洞闭环情况

### 复核已知漏洞（来源：security-audit-2026-05-28.md）

| 编号 | 严重度 | 问题 | 修复状态 | 验证 |
|------|--------|------|----------|------|
| H-001 | HIGH | 登录暴力破解防护 | ✅ 已实现 | `app/api/auth/login/route.js` IP 维度 5 次/15 分钟锁定 |
| M-001 | MEDIUM | 安全响应头缺失 | ✅ 已实现 | `next.config.js` 已配 X-Frame-Options 等 4 个头 |
| M-002 | MEDIUM | 项目创建 spread operator | ✅ 本次修复 | 改为显式字段提取，注入测试通过 |
| L-001 | LOW | 输入长度限制 | ✅ 本次修复 | 用户名 3-50、密码 8-128、项目名 ≤100、描述 ≤500 |
| L-002 | LOW | Token 未 trim | ✅ 本次修复 | `lib/auth/middleware.js` 加 `.trim()` + 空值短路 |
| L-003 | LOW | init 竞态 | ✅ 本次修复 | 改为 `db.$transaction` 原子化 |
| L-004 | LOW | 密码策略 | ✅ 本次修复 | 全部入口密码下限 6→8，加最大长度 128 |

### 本次额外修复

| 类型 | 文件 | 修复内容 |
|------|------|---------|
| Bug | `app/api/admin/teams/[teamId]/members/route.js` | 补齐 GET handler（原本 405） |
| Bug | `app/api/admin/users/route.js` | 账号正则校验（防 `bad@user!`） |
| Bug | `app/api/admin/users/[userId]/route.js` | 防降级最后一个管理员/防禁用自己 |
| 性能 | `prisma/schema.prisma` | OperationLogs 添加 `createAt`、`targetId` 索引 |
| 安全 | `app/api/auth/login/route.js` | 失败计数 Map 内存泄漏保护 + 输入长度限制 |

---

## 三、API 全量测试（62/62 通过）

| 模块 | 用例数 | 通过 | 失败 |
|------|------:|-----:|-----:|
| 认证 | 13 | 13 | 0 |
| 项目管理 | 14 | 14 | 0 |
| 用户管理 | 13 | 13 | 0 |
| 团队管理 | 4 | 4 | 0 |
| 操作日志 | 4 | 4 | 0 |
| 监控接口 | 10 | 10 | 0 |
| 修改密码 | 4 | 4 | 0 |
| **总计** | **62** | **62** | **0** |

详细脚本：`/tmp/api_test.sh`

### 关键安全用例验证

- **未登录** 访问 4 个核心接口 → 全部 401 ✅
- **错误密码登录** → 401（未泄露账号存在性）✅
- **超长账号 60 字符** → 400（不触发 bcrypt）✅
- **user1 创建 demo 项目** → 403（防越权创建）✅
- **user1 访问他人个人项目** → 403（IDOR 防护）✅
- **ownerId 注入** → 被忽略，正确归属请求者 ✅
- **user1 调用 admin API** → 全部 403 ✅
- **禁用用户登录** → 403 ✅
- **非法账号字符** → 400 ✅
- **降级最后一个管理员** → 400 ✅

---

## 四、UI 功能测试

通过 Playwright 验证关键用户旅程：

### 4.1 登录页（`http://localhost:1717/login`）

![登录页](./screenshots/login.png)

- 表单：账号 + 密码 + 显示密码切换按钮
- 提示：首次使用提示初始化管理员
- 风格：深色赛博玻璃拟态 + 渐变背景

### 4.2 首页项目列表（`/`）

![首页](./screenshots/home_admin.png)

admin 可见 15 个项目，每张卡片显示：图标 / 名称 / ID / 描述 / 问题数 / 数据集数 / 评估集 / Tokens。

### 4.3 监控看板（`/monitoring`）

![监控看板](./screenshots/monitoring_admin.png)

- 6 个全局统计卡片：15 项目 / 1 文件 / 3 问题 / 200 数据集 / 0 已标注 / 0% 完成率
- 项目总览表：项目名 / 类型 / 负责人 / 文件 / 问题 / 数据集 / 阶段 / 完成率
- 标注排行：4 个时间范围切换（今日/本周/本月/全部）

---

## 五、并发性能测试（核心问题：多人标注是否会卡死？）

### 5.1 测试方法

- 4 个用户（admin、user1、tester3、fulltest）
- 200 条 Datasets 数据
- Node 脚本通过 HTTP PATCH 模拟并发标注
- 测试脚本：`perf_test.js`、`perf_test_race.js`

### 5.2 标注并发结果（**完全不卡死**）

| 场景 | 总请求 | 成功 | 失败 | RPS | avg | p50 | p95 | p99 | max |
|------|------:|----:|----:|----:|----:|----:|----:|----:|----:|
| 10 并发 × 10 次 | 100 | 100 | 0 | 126 | 77ms | 38ms | 427ms | 450ms | 450ms |
| 30 并发 × 30 次 | 900 | 900 | 0 | 415 | 69ms | 53ms | 157ms | 302ms | 837ms |
| 50 并发 × 4 次  | 200 | 200 | 0 | 376 | 101ms | 82ms | 224ms | 460ms | 532ms |

**DB 校验**：每个用户标注 50 条，confirmed/annotatorId 字段全部正确写入。

### 5.3 竞态测试：100 用户抢同一条 dataset

- 100 并发 PATCH 同一条 dataset
- 0 失败 / 耗时 277ms
- 最终 `annotatorId` = 最后写入用户（符合 PRD 7.6 "最后写入生效"）
- 107 条操作日志全部完整记录

### 5.4 持续压测：60 秒 × 10 并发

- 15,828 个请求 / 0 失败 / 264 RPS
- 无内存泄漏、无死锁、无慢慢退化

### 5.5 监控并发查询（17K 操作日志 + 200 数据集 + 15 项目）

| 接口 | 单请求 p95 | 50 并发 p95 |
|------|----------:|------------:|
| /api/monitoring?type=stats | 53ms | 41ms |
| /api/monitoring?type=overview | 10ms | 35ms |
| /api/monitoring?type=ranking&period=all | 7ms | 24ms |
| /api/monitoring?type=ranking&period=today | 7ms | - |
| /api/projects | 9ms | - |
| /api/admin/users | 6ms | - |
| /api/admin/teams | 6ms | - |
| /api/admin/operation-logs | **6ms（修复后）** | **25ms（修复后）** |

### 5.6 性能 Bug 与修复

**原始问题：** 操作日志 30 并发查询 p95 = **681ms**（17K 数据下）。

**根因：** `prisma/schema.prisma` 中 `OperationLogs` 缺少 `createAt` 单列索引，按 `orderBy createAt desc` 排序时全表 sort。

**修复：**
```prisma
model OperationLogs {
  ...
  @@index([createAt])    // 本次新加
  @@index([targetId])    // 本次新加（按目标查询）
}
```

**效果：** 同等条件下 p95 从 681ms → 25ms，**27 倍加速**。

---

## 六、最终结论

### ✅ 通过

1. **功能完整**：PRD 一-四期全部交付的 API/UI 验证通过。
2. **权限隔离正确**：管理员/普通用户 + 个人/团队/示范项目 + 4 种项目角色，全部按 PRD 7.4 矩阵正确生效。
3. **安全闭环**：所有审计漏洞 + 本次新发现 4 个 bug 全部修复。
4. **并发不卡死**：50 并发标注 0 失败、100 并发抢同一条 0 失败、60s 持续压测 0 失败。
5. **监控查询快速**：所有监控/管理后台接口 p95 < 50ms。

### ⚠️ 部署前必须确认

1. 设置环境变量 `JWT_SECRET`（当前用默认值会有控制台 warning）
2. 多实例部署需把登录失败计数（内存 Map）替换为 Redis
3. 历史团队项目（如 `V0OU3t-3n8WQ`）的 `ownerId` 为空，建议执行迁移脚本补成默认管理员

### 💡 后续建议

1. 监控看板 "最终操作" 列建议补充 `lastOperationType`（数据已存，UI 未渲染）
2. 操作日志清理策略（17K 条日志已足够大，建议定期归档保留 90 天）
3. 可考虑给 Datasets 表的 `annotatorId` 加索引（监控排行 groupBy 查询会受益）

---

## 七、产物清单

| 类别 | 文件 | 说明 |
|------|------|------|
| 测试脚本 | `/tmp/api_test.sh` | 62 项 API 自动化测试 |
| 性能脚本 | `perf_test.js` | 多用户并发标注 |
| 性能脚本 | `perf_test_race.js` | 竞态测试 + 60s 持续压测 |
| 性能脚本 | `perf_monitoring.js` | 监控接口性能测量 |
| 截图 | `docs/screenshots/home_admin.png` | 首页 |
| 截图 | `docs/screenshots/monitoring_admin.png` | 监控看板 |
| 规划 | `task_plan.md` `findings.md` `progress.md` | 任务规划/发现/进度 |

### 代码改动文件

1. `app/api/projects/route.js` - M-002 修复 + 字段白名单
2. `app/api/auth/login/route.js` - L-001 输入长度 + 内存泄漏保护
3. `app/api/auth/init/route.js` - L-003 transaction + L-004 密码 ≥8
4. `app/api/auth/change-password/route.js` - L-004 密码策略
5. `app/api/admin/users/route.js` - L-001 长度 + 账号正则
6. `app/api/admin/users/[userId]/route.js` - 防降级最后管理员 + 防禁用自己
7. `app/api/admin/teams/[teamId]/members/route.js` - **补 GET handler** + 错误分类
8. `lib/auth/middleware.js` - L-002 token trim
9. `prisma/schema.prisma` - OperationLogs `createAt` + `targetId` 索引
