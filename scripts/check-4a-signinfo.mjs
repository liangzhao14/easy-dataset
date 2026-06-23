// 4A signInfo 自测 / 联调参考脚本（独立，不依赖 Next 运行时）。
// 复刻 lib/auth/4a/sign.js 的 signInfo 公式——改公式时两处都要改。
// 用途：
//   1) 校验实现产出 32 位小写 hex、且拼接顺序稳定（回归保护）。
//   2) 联调时把真实 appSecret 填进 BS 样例，应能复算出手册样例值 91820a...（核对算法）。
// 运行：node scripts/check-4a-signinfo.mjs
import crypto from 'crypto';

function computeSignInfo({ version, appKey, appMethod, timestamp, format, appSecret }) {
  const original = `${version}${appKey}${appMethod}${timestamp}${format}${appSecret}`;
  return crypto.createHash('md5').update(original, 'utf8').digest('hex');
}

// —— BS 指南 §3.4 getOauth2Token 请求样例（权威，用户确认以 BS 指南为准）——
// 已知输入俱全，唯独 appSecret 手册未公开；联调拿到真 appSecret 后应复算出 expectedSignInfo。
const bsSample = {
  version: '1',
  appKey: '15e12298e1244901bbed36000efce221',
  appMethod: '/authcenter/getOriginalForSign', // 固定值，非业务端点
  timestamp: '1593668975', // epoch 秒
  format: 'json',
  appSecret: process.env.CGN_4A_SAMPLE_APP_SECRET || '<联调时填真实 appSecret>',
  expectedSignInfo: '91820a135da0cafc9b278d7f0b014830'
};

const sign = computeSignInfo(bsSample);
console.log('BS 样例输入 → 我方 signInfo:', sign);
console.log('BS 样例手册期望 signInfo  :', bsSample.expectedSignInfo);
if (bsSample.appSecret.startsWith('<')) {
  console.log('（未提供真实 appSecret，无法核对期望值；设 CGN_4A_SAMPLE_APP_SECRET 后可核对）');
} else {
  console.log(sign === bsSample.expectedSignInfo ? '🎯 与手册样例一致，算法确认无误' : '❌ 与手册样例不一致，检查参数/拼接顺序');
}

const isHex32 = /^[0-9a-f]{32}$/.test(sign);
if (!isHex32) {
  console.error('❌ signInfo 不是 32 位小写 hex');
  process.exit(1);
}
console.log('✅ 格式校验通过（32 位小写 hex），拼接顺序：version+appKey+appMethod+timestamp+format+appSecret');
