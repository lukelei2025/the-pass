/**
 * 环境变量校验
 *
 * 在应用启动时验证必需的环境变量
 */

/**
 * 环境变量配置接口
 */
interface EnvConfig {
  firebaseApiKey: string;
  wechatWorkerUrl: string;
  titleProxyUrl: string;
  classifyWorkerUrl: string;
}

/**
 * 获取并验证环境变量
 *
 * @returns 验证后的环境变量配置
 * @throws 如果必需的环境变量缺失
 */
export function validateEnv(): EnvConfig {
  const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
  const wechatWorkerUrl =
    import.meta.env.VITE_WECHAT_WORKER_URL ||
    'https://wechat-title-api.lukelei-workbench.workers.dev';
  const titleProxyUrl =
    import.meta.env.VITE_TITLE_PROXY_URL ||
    'https://workbench-title-proxy.lukelei-workbench.workers.dev';
  const classifyWorkerUrl =
    import.meta.env.VITE_CLASSIFY_WORKER_URL ||
    'https://workbench-title-proxy.lukelei-workbench.workers.dev';

  // 验证 Firebase API Key
  if (!firebaseApiKey || firebaseApiKey.trim() === '') {
    console.error(
      '❌ [Env] 缺少必需的环境变量: VITE_FIREBASE_API_KEY'
    );
    console.error('[Env] 请在 .env 文件中配置 Firebase API Key');
    console.error('[Env] 应用将无法正常工作');
    throw new Error('Missing required environment variable: VITE_FIREBASE_API_KEY');
  }

  console.log('✅ [Env] 环境变量校验通过');
  console.log('[Env] Firebase API Key:', `${firebaseApiKey.slice(0, 8)}...`);
  console.log('[Env] WeChat Worker:', wechatWorkerUrl);
  console.log('[Env] Title Proxy:', titleProxyUrl);
  console.log('[Env] Classify Worker:', classifyWorkerUrl);

  return {
    firebaseApiKey,
    wechatWorkerUrl,
    titleProxyUrl,
    classifyWorkerUrl,
  };
}

/**
 * 获取环境变量（单例模式）
 * 仅在首次调用时验证，后续调用返回缓存结果
 */
const cachedEnv = validateEnv();

export function getEnv(): EnvConfig {
  return cachedEnv;
}
