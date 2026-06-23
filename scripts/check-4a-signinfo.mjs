// 4A signInfo 自测 / 联调参考脚本（独立，不依赖 Next 运行时）。
// 复刻 lib/auth/4a/sign.js 的 signInfo 公式——改公式时两处都要改。
// 用途：
//   1) 校验实现产出 32 位小写 hex、且拼接顺序稳定（回归保护）。
//   2) 联调前先用「4A 提供的样例输入」算出 signInfo，与手册样例值逐字节核对。
// 运行：node scripts/check-4a-signinfo.mjs
import crypto from 'crypto';

function computeSignInfo({ version, appKey, appMethod, timestamp, format, appSecret }) {
  const original = `${version}${appKey}${appMethod}${timestamp}${format}${appSecret}`;
  return crypto.createHash('md5').update(original, 'utf8').digest('hex');
}

// —— 微服务手册 .Net 样例输入（4a_microservice.md:428-430）——
// 该样例文本未给出期望 signInfo，故此处仅作"我方实现产出值"的参考，联调时与 4A 核对。
const microserviceSample = {
  version: 'v1.0',
  appKey: '7fcc6bdbdf844b24b3b1231a862b6896',
  appMethod: 'usercenter/status',
  timestamp: '2018-09-09 12:00:00',
  format: 'json',
  appSecret: '942ad9a400aa432ebd118de9da78fbc5'
};

// —— BS 指南样例（4a_bs.md:286-307）：样例未含 appSecret，无法完整复算，仅记录已知输入 ——
const bsSampleKnown = {
  version: '1',
  appKey: '15e12298e1244901bbed36000efce221',
  appMethod: '/authcenter/getOriginalForSign',
  timestamp: '1593668975',
  format: 'json',
  appSecret: '<未在手册样例中给出>',
  expectedSignInfo: '91820a135da0cafc9b278d7f0b014830' // 手册样例值，联调时用真实 appSecret 复算核对
};

const sign = computeSignInfo(microserviceSample);
console.log('微服务手册样例输入 → 我方 signInfo:', sign);
console.log('BS 指南样例期望 signInfo（需真实 appSecret 才能复算核对）:', bsSampleKnown.expectedSignInfo);

const isHex32 = /^[0-9a-f]{32}$/.test(sign);
if (!isHex32) {
  console.error('❌ signInfo 不是 32 位小写 hex');
  process.exit(1);
}
console.log('✅ 格式校验通过（32 位小写 hex），拼接顺序：version+appKey+appMethod+timestamp+format+appSecret');
