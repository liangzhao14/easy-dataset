// 公开的前端配置端点：登录页据此决定展示「4A 登录」还是本地密码表单。
// 只暴露布尔特性开关，不含任何密钥（设计 §7）。
import { is4AEnabled, fourAConfig } from '@/lib/auth/4a/config';

// 必须动态：否则 Next 会在构建时静态预渲染（烤进构建时的 env），
// 生产里改 CGN_4A_* 后该接口仍返回旧值，登录页就分支错了。
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    fourAEnabled: is4AEnabled(),
    localLoginEnabled: fourAConfig.localLoginEnabled
  });
}
