// 中广核 4A 统一认证 —— 集中读取所有 CGN_4A_* 环境变量。
// 本模块只读 env、不依赖 DB / Node 重型模块，可被任意服务端代码安全 import。
// 设计参考：docs/4a-sso-integration-design.md §6.1 / §8 / §4.3

function bool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return v === 'true' || v === '1';
}

export const fourAConfig = {
  // 开关
  enabled: bool(process.env.CGN_4A_ENABLED),
  localLoginEnabled: bool(process.env.CGN_LOCAL_LOGIN_ENABLED, true),

  // OAuth 应用凭证
  clientId: process.env.CGN_4A_CLIENT_ID || '',
  clientSecret: process.env.CGN_4A_CLIENT_SECRET || '',
  redirectUri: process.env.CGN_4A_REDIRECT_URI || '',

  // 端点地址
  authorizeUrl: process.env.CGN_4A_AUTHORIZE_URL || '',
  tokenUrl: process.env.CGN_4A_TOKEN_URL || '',
  userinfoUrl: process.env.CGN_4A_USERINFO_URL || '',
  logoutUrl: process.env.CGN_4A_LOGOUT_URL || '',
  httpMethod: (process.env.CGN_4A_HTTP_METHOD || 'POST').toUpperCase(),

  // 中台网关凭证（签 signInfo 用）
  appKey: process.env.CGN_4A_APP_KEY || '',
  appSecret: process.env.CGN_4A_APP_SECRET || '',
  appId: process.env.CGN_4A_APP_ID || '',
  appCode: process.env.CGN_4A_APP_CODE || '',
  tenantId: process.env.CGN_4A_TENANT_ID || '1',
  appIdParam: process.env.CGN_4A_APP_ID_PARAM || '',
  version: process.env.CGN_4A_VERSION || '1',
  format: process.env.CGN_4A_FORMAT || 'json',
  // epoch_seconds（推荐，10位秒）| datetime（yyyy-MM-dd HH:mm:ss）—— 见 §4.3 / §10
  timestampFormat: process.env.CGN_4A_TIMESTAMP_FORMAT || 'epoch_seconds',

  // 内网自签证书
  caCert: process.env.CGN_4A_CA_CERT || '',
  insecureTls: bool(process.env.CGN_4A_INSECURE_TLS)
};

/**
 * 4A 是否启用：开关打开且发起登录所需的关键配置齐全。
 * middleware 用它决定是否强制跳转——缺配置时返回 false 短路放行，
 * 避免本地/未配置环境因强制跳 4A 而打不开（设计 §13.6）。
 */
export function is4AEnabled() {
  const c = fourAConfig;
  return Boolean(c.enabled && c.clientId && c.redirectUri && c.authorizeUrl && c.tokenUrl);
}
