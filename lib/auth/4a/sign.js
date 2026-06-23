// 中台网关签名头（signInfo）。约定见 docs/4a-sso-integration-design.md §4.3 / §6.2。
// signInfo = md5(version + appKey + appMethod + timestamp + format + appSecret) 小写 hex。
// ⚠️ 改动签名公式/拼接顺序时，请同步更新 scripts/check-4a-signinfo.mjs。
import crypto from 'crypto';
import { fourAConfig } from './config';

/**
 * 生成 timestamp，格式由 CGN_4A_TIMESTAMP_FORMAT 决定。
 * 默认 epoch 秒（OAuth 线）；datetime 为 yyyy-MM-dd HH:mm:ss（微服务线）。
 */
export function buildTimestamp(now = new Date()) {
  if (fourAConfig.timestampFormat === 'datetime') {
    const p = n => String(n).padStart(2, '0');
    return (
      `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ` +
      `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
    );
  }
  return String(Math.floor(now.getTime() / 1000)); // epoch_seconds（10 位）
}

/** 计算 signInfo（小写 hex MD5）。secretKey == appSecret。 */
export function computeSignInfo({ version, appKey, appMethod, timestamp, format, appSecret }) {
  const original = `${version}${appKey}${appMethod}${timestamp}${format}${appSecret}`;
  return crypto.createHash('md5').update(original, 'utf8').digest('hex');
}

/**
 * 构造一次中台网关调用所需的全部请求头。
 * @param {string} appMethod 当次端点路径，如 /authcenter/getOauth2Token。
 *   注意：signInfo 内与请求头里的 timestamp 必须是同一个值（本函数已保证）。
 */
export function buildGatewayHeaders(appMethod) {
  const c = fourAConfig;
  const timestamp = buildTimestamp();
  const signInfo = computeSignInfo({
    version: c.version,
    appKey: c.appKey,
    appMethod,
    timestamp,
    format: c.format,
    appSecret: c.appSecret
  });

  const headers = {
    requestId: crypto.randomUUID(),
    version: c.version,
    appId: c.appId,
    appMethod,
    timestamp,
    format: c.format,
    signInfo,
    appKey: c.appKey,
    appCode: c.appCode,
    tenantId: c.tenantId
  };
  // appIdParam：CSP 申请发放，推荐带上；为空则不发（是否必传待联调确认，见 §10）。
  if (c.appIdParam) headers.appIdParam = c.appIdParam;
  return headers;
}
