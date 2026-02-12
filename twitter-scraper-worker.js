/**
 * Cloudflare Workers - Twitter/X 推文解析器
 *
 * 功能：
 * - 接收任何 X/Twitter 链接
 * - 返回推文的作者、用户名和内容
 * - 内置缓存（使用 Cloudflare KV）
 * - 支持多种方法自动降级
 *
 * 部署方式：
 * 1. 创建 Cloudflare Worker
 * 2. 绑定 KV 命名空间（可选，用于缓存）
 * 3. 设置环境变量 JINA_API_KEY（可选）
 */

// 配置
const CONFIG = {
  CACHE_TTL: 300, // 缓存5分钟
  TIMEOUT: 10000, // 10秒超时
  USER_AGENT: 'Mozilla/5.0 (compatible; TwitterScraper/1.0)',
};

/**
 * 主入口
 */
export default {
  async fetch(request, env, ctx) {
    // 处理 CORS
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // 只接受 GET 请求
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const url = new URL(request.url);
      const tweetUrl = url.searchParams.get('url');

      if (!tweetUrl) {
        return jsonResponse({ error: 'Missing "url" parameter' }, 400);
      }

      // 验证是否是 Twitter/X 链接
      if (!isValidTwitterUrl(tweetUrl)) {
        return jsonResponse({ error: 'Invalid Twitter/X URL' }, 400);
      }

      // 提取推文 ID
      const tweetId = extractTweetId(tweetUrl);
      if (!tweetId) {
        return jsonResponse({ error: 'Cannot extract tweet ID' }, 400);
      }

      // 检查缓存
      if (env.CACHE) {
        const cached = await env.CACHE.get(`tweet:${tweetId}`, 'json');
        if (cached) {
          return jsonResponse({ ...cached, cached: true });
        }
      }

      // 获取推文信息
      const result = await getTweetInfo(tweetUrl, env.JINA_API_KEY);

      // 存入缓存
      if (env.CACHE && !result.error) {
        ctx.waitUntil(env.CACHE.put(`tweet:${result.tweetId}`, JSON.stringify(result), {
          expirationTtl: CONFIG.CACHE_TTL,
        }));
      }

      return jsonResponse(result);

    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  },
};

/**
 * 获取推文信息
 */
async function getTweetInfo(tweetUrl, apiKey = null) {
  // 按优先级尝试各种方法
  const methods = [
    methodJinaReader,
    methodNitter,
    methodMetaTags,
  ];

  for (const method of methods) {
    try {
      const result = await method(tweetUrl, apiKey);
      if (result && !result.error) {
        result.url = tweetUrl;
        result.tweetId = extractTweetId(tweetUrl);
        return result;
      }
    } catch (error) {
      console.error(`${method.name} failed:`, error);
      continue;
    }
  }

  return {
    error: 'All methods failed',
    url: tweetUrl,
    tweetId: extractTweetId(tweetUrl),
  };
}

/**
 * 方法1: jina.ai Reader API（推荐）
 */
async function methodJinaReader(tweetUrl, apiKey = null) {
  try {
    const cleanUrl = tweetUrl.replace(/^https?:\/\//, '');
    const jinaUrl = `https://r.jina.ai/http://${cleanUrl}`;

    const headers = {
      'User-Agent': CONFIG.USER_AGENT,
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(jinaUrl, {
      headers,
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });

    if (response.status === 429) {
      return {
        error: 'Rate limit exceeded',
        message: 'Please configure JINA_API_KEY',
      };
    }

    if (response.status !== 200) {
      return { error: `HTTP ${response.status}` };
    }

    const content = await response.text();

    // 解析内容
    const urlMatch = tweetUrl.match(/(?:twitter|x)\.com\/(\w+)\/status/);
    const username = urlMatch ? urlMatch[1] : 'unknown';

    const lines = content.split('\n');
    const titleLine = lines[0] || '';

    // 提取推文内容
    const contentMatch = titleLine.match(/"(.+?)"(?:\s*\/\s*X)?$/);
    let title = contentMatch ? contentMatch[1] : titleLine;

    if (!contentMatch) {
      const titleMatch = titleLine.match(/:\s*"(.+)"/);
      title = titleMatch ? titleMatch[1] : titleLine;
    }

    // 提取作者
    const authorMatch = titleLine.match(/Title:\s*(.+?)\s+on X:/);
    const author = authorMatch ? authorMatch[1] : username;

    // 清理标题
    if (title.startsWith('Title: ')) {
      title = title.slice(7);
    }

    return {
      author,
      username,
      title,
      method: 'jina_reader',
    };

  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return { error: 'Timeout' };
    }
    return { error: error.message };
  }
}

/**
 * 方法2: nitter 镜像站（备用）
 */
async function methodNitter(tweetUrl) {
  const nitterInstances = [
    'nitter.net',
    'nitter.poast.org',
    'nitter.privacydev.net',
  ];

  for (const instance of nitterInstances) {
    try {
      const nitterUrl = tweetUrl.replace(/(twitter|x)\.com/, instance);

      const response = await fetch(nitterUrl, {
        headers: { 'User-Agent': CONFIG.USER_AGENT },
        signal: AbortSignal.timeout(CONFIG.TIMEOUT),
      });

      if (response.status !== 200) continue;

      const html = await response.text();

      // 简单的 HTML 解析
      const usernameMatch = html.match(/class="username"[^>]*>(@\w+)</);
      const username = usernameMatch ? usernameMatch[1].replace('@', '') : 'unknown';

      const authorMatch = html.match(/class="fullname"[^>]*>([^<]+)</);
      const author = authorMatch ? authorMatch[1].trim() : username;

      const contentMatch = html.match(/class="tweet-content"[^>]*>([\s\S]*?)<\/div>/);
      let title = '';
      if (contentMatch) {
        const textMatch = contentMatch[1].match(/class="tweet-text"[^>]*>([^<]+)</);
        title = textMatch ? textMatch[1].trim() : '';
      }

      return {
        author,
        username,
        title,
        method: 'nitter',
      };

    } catch (error) {
      continue;
    }
  }

  return { error: 'All nitter instances failed' };
}

/**
 * 方法3: 直接解析 meta 标签
 */
async function methodMetaTags(tweetUrl) {
  try {
    const response = await fetch(tweetUrl, {
      headers: { 'User-Agent': CONFIG.USER_AGENT },
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
      redirect: 'follow',
    });

    if (response.status !== 200) {
      return { error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // 提取 meta 标签
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

    let titleText = titleMatch ? titleMatch[1] : '';
    if (!titleText && descMatch) {
      titleText = descMatch[1];
    }

    // 解析作者和内容
    const authorMatch = titleText.match(/(.+?)\s+(?:on X|on Twitter)/);
    const author = authorMatch ? authorMatch[1] : 'unknown';

    const urlMatch = tweetUrl.match(/(?:twitter|x)\.com\/(\w+)\/status/);
    const username = urlMatch ? urlMatch[1] : author;

    const contentMatch = titleText.match(/"(.+)"/);
    if (contentMatch) {
      titleText = contentMatch[1];
    }

    return {
      author,
      username,
      title: titleText,
      method: 'meta_tags',
    };

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * 从 URL 提取推文 ID
 */
function extractTweetId(url) {
  const patterns = [
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/\w+\/status\/(\d+)/,
    /mobile\.twitter\.com\/\w+\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * 验证是否是有效的 Twitter/X URL
 */
function isValidTwitterUrl(url) {
  try {
    const urlObj = new URL(url);
    const validHosts = ['twitter.com', 'x.com', 'mobile.twitter.com'];
    return validHosts.includes(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * 处理 CORS 预检请求
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
