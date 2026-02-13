/**
 * API 配置管理
 * 统一管理所有外部 API 端点
 */

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  /**
   * 微信公众号标题抓取 Worker
   */
  wechatWorker: import.meta.env.VITE_WECHAT_WORKER_URL ||
    'https://wechat-title-api.lukelei-workbench.workers.dev',

  /**
   * 通用标题代理 Worker（Cloudflare）
   */
  titleProxy: import.meta.env.VITE_TITLE_PROXY_URL ||
    'https://workbench-title-proxy.lukelei-workbench.workers.dev',

  /**
   * LLM 分类 Worker（复用 titleProxy）
   */
  classifyWorker: import.meta.env.VITE_CLASSIFY_WORKER_URL ||
    'https://workbench-title-proxy.lukelei-workbench.workers.dev',
} as const;

/**
 * 构建带有 URL 参数的 Worker 请求地址
 *
 * @param endpoint - 基础端点
 * @param params - URL 参数对象
 * @returns 完整的 URL
 */
export function buildWorkerUrl(endpoint: string, params: Record<string, string>): string {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
}

/**
 * 请求超时配置（毫秒）
 */
export const REQUEST_TIMEOUT = {
  default: 30000,
  fast: 10000,
  slow: 60000,
} as const;

/**
 * 重试配置
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: 1000,
} as const;
