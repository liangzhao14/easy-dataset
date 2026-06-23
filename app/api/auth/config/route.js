// 公开的前端配置端点：登录页据此决定展示「4A 登录」还是本地密码表单。
// 只暴露布尔特性开关，不含任何密钥（设计 §7）。
import { is4AEnabled, fourAConfig } from '@/lib/auth/4a/config';

export async function GET() {
  return Response.json({
    fourAEnabled: is4AEnabled(),
    localLoginEnabled: fourAConfig.localLoginEnabled
  });
}
