// 4A / 中台网关 HTTP 客户端：换 token、取用户、单点登出。
// 接口参数依据 BS 指南「接口说明」（getOauth2Token / getOauth2UserInfo / userLogout）。
// ⚠️ Node-only（https / fs / crypto）——禁止被 Edge middleware import（设计 §13.1）。
import https from 'https';
import fs from 'fs';
import { fourAConfig } from './config';
import { buildGatewayHeaders } from './sign';

let cachedAgent;

/** 内置 https.Agent：优先内网 CA；INSECURE_TLS=true 时关闭校验（仅测试，有 MITM 风险）。 */
function getAgent() {
  if (cachedAgent) return cachedAgent;
  const opts = {};
  if (fourAConfig.caCert) {
    try {
      opts.ca = fs.readFileSync(fourAConfig.caCert);
    } catch (e) {
      console.warn(`[4a] 读取 CA 证书失败(${fourAConfig.caCert})：${e.message}`);
    }
  }
  if (fourAConfig.insecureTls) {
    opts.rejectUnauthorized = false;
    console.warn('[4a] CGN_4A_INSECURE_TLS=true，已关闭 TLS 校验——仅限测试环境！');
  }
  cachedAgent = new https.Agent(opts);
  return cachedAgent;
}

/** 用 node https 发请求并返回 { status, body }，便于注入自签 CA 的 agent。 */
function httpsRequest(urlStr, { method, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers,
        agent: getAgent()
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * 调用一个中台网关端点。appMethod 自动取 URL 的 pathname（= 当次端点路径，见 §4.3）。
 * 业务参数默认走 query string（中台网关惯例）；联调若需改为 form/json body，仅在此处调整。
 */
async function gatewayCall(url, params) {
  if (!url) throw new Error('[4a] 端点 URL 未配置');
  const appMethod = new URL(url).pathname;
  const headers = buildGatewayHeaders(appMethod);
  const method = fourAConfig.httpMethod === 'GET' ? 'GET' : 'POST';

  const qs = new URLSearchParams(params).toString();
  const target = url + (url.includes('?') ? '&' : '?') + qs;
  let body;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = ''; // 参数已在 query string；如改走 body，把 qs 移到这里
  }

  const res = await httpsRequest(target, { method, headers, body });
  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new Error(`[4a] ${appMethod} 返回非 JSON (HTTP ${res.status})：${(res.body || '').slice(0, 200)}`);
  }
  // 错误应答：{ error, error_description }（token/userinfo）
  if (json.error) {
    throw new Error(`[4a] ${appMethod} 失败：${json.error} ${json.error_description || ''}`);
  }
  return json;
}

/** 授权码换访问令牌 → { access_token, expires_in } */
export async function getToken(code) {
  return gatewayCall(fourAConfig.tokenUrl, {
    grant_type: 'authorization_code',
    client_id: fourAConfig.clientId,
    client_secret: fourAConfig.clientSecret,
    code,
    redirect_uri: fourAConfig.redirectUri
  });
}

/** 令牌取用户属性 → { usercode, username, userorg, orgname }（实际 JSON 外层结构待联调确认） */
export async function getUserInfo(accessToken) {
  return gatewayCall(fourAConfig.userinfoUrl, {
    access_token: accessToken,
    client_id: fourAConfig.clientId
  });
}

/** 单点登出（切换用户场景必须先调，否则 SSO 会自动复登同一人） */
export async function logout(accessToken) {
  return gatewayCall(fourAConfig.logoutUrl, {
    access_token: accessToken,
    client_id: fourAConfig.clientId
  });
}
