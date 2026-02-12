/**
 * Cloudflare Workers - 小红书链接解析器
 * 优化版本 - 基于真实小红书页面结构
 *
 * 功能：
 * - 接收小红书链接，返回标题、作者、内容、标签、地点等
 * - 支持标准链接和短链接 (xhslink.com)
 * - 内置 KV 缓存
 * - 多方法自动降级
 *
 * 部署：
 * 1. 复制到 Cloudflare Workers
 * 2. 可选：绑定 KV 命名空间 CACHE
 * 3. 可选：设置环境变量 JINA_API_KEY
 */

// 配置
const CONFIG = {
  CACHE_TTL: 300, // 缓存5分钟
  TIMEOUT: 15000, // 15秒超时（小红书可能较慢）
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const url = new URL(request.url);
      const xhsUrl = url.searchParams.get('url');

      if (!xhsUrl) {
        return jsonResponse({ error: 'Missing "url" parameter' }, 400);
      }

      // 验证是否是小红书链接
      if (!isValidXiaohongshuUrl(xhsUrl)) {
        return jsonResponse({ error: 'Invalid Xiaohongshu URL' }, 400);
      }

      // 提取笔记 ID
      const noteId = await extractNoteId(xhsUrl);
      if (!noteId) {
        return jsonResponse({ error: 'Cannot extract note ID' }, 400);
      }

      // 检查缓存
      if (env.CACHE) {
        const cached = await env.CACHE.get(`xhs:${noteId}`, 'json');
        if (cached) {
          return jsonResponse({ ...cached, cached: true });
        }
      }

      // 获取笔记信息
      const result = await getXiaohongshuInfo(xhsUrl, noteId, env.JINA_API_KEY);

      // 存入缓存
      if (env.CACHE && !result.error) {
        ctx.waitUntil(env.CACHE.put(`xhs:${noteId}`, JSON.stringify(result), {
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
 * 获取小红书笔记信息
 */
async function getXiaohongshuInfo(xhsUrl, noteId, apiKey = null) {
  const methods = [
    methodJinaReader,
    methodMetaTags,
  ];

  for (const method of methods) {
    try {
      const result = await method(xhsUrl, noteId, apiKey);
      if (result && !result.error) {
        result.url = xhsUrl;
        result.note_id = noteId;
        return result;
      }
    } catch (error) {
      console.error(`${method.name} failed:`, error);
      continue;
    }
  }

  return {
    error: 'All methods failed',
    url: xhsUrl,
    note_id: noteId,
  };
}

/**
 * 方法1: jina.ai Reader API（推荐，最稳定）
 */
async function methodJinaReader(xhsUrl, noteId, apiKey = null) {
  try {
    const cleanUrl = xhsUrl.replace(/^https?:\/\//, '');
    const jinaUrl = `https://r.jina.ai/http://${cleanUrl}`;

    const headers = { 'User-Agent': CONFIG.USER_AGENT };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(jinaUrl, {
      headers,
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });

    if (response.status === 429) {
      return { error: 'Rate limit exceeded', message: 'Configure JINA_API_KEY' };
    }

    if (response.status !== 200) {
      return { error: `HTTP ${response.status}` };
    }

    const content = await response.text();
    return parseXiaohongshuContent(content);

  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return { error: 'Timeout' };
    }
    return { error: error.message };
  }
}

/**
 * 方法2: 解析 meta 标签（备用方案）
 */
async function methodMetaTags(xhsUrl, noteId, apiKey = null) {
  try {
    const response = await fetch(xhsUrl, {
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
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    const title = titleMatch ? simpleDecodeHtml(titleMatch[1]) : '';
    const description = descMatch ? simpleDecodeHtml(descMatch[1]) : '';
    const image = imageMatch ? imageMatch[1] : '';

    return {
      title,
      content: description,
      description,
      images: image ? [image] : [],
      author: '',
      method: 'meta_tags',
    };

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * 解析小红书内容（基于真实页面结构优化）
 */
function parseXiaohongshuContent(content) {
  const result = {
    title: '',
    author: '',
    content: '',
    description: '',
    images: [],
    tags: [],
    location: '',
    stats: {},
  };

  // 清理内容
  let cleanContent = content
    .replace(/={20,}/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // ========== 1. 提取标题 ==========
  // 格式：标题 - 小红书
  const titleMatch = cleanContent.match(/^([^\n]+?)\s*-\s*小红书/m);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  // ========== 2. 提取作者 ==========
  // 查找 .create 结尾的用户名
  const authorPatterns = [
    /([a-zA-Z0-9_]+\.create)/,
    /([^\s]+\.create)\s*关注/,
  ];
  for (const pattern of authorPatterns) {
    const match = cleanContent.match(pattern);
    if (match && !result.author) {
      result.author = match[1];
    }
  }

  // ========== 3. 提取正文内容 ==========
  // 小红书正文通常在标题后面，标签前面
  // 查找 "在做过一些" 等正文开始的关键词
  const contentStartPatterns = [
    /在做过一些[^，。]+\n([\s\S]+?)(?=\n#|$)/,
    /由此做了[^，。]+\n([\s\S]+?)(?=\n#|$)/,
    /([^\n]+\.create\s*\n)([\s\S]+?)(?=\n#|$)/,
  ];

  for (const pattern of contentStartPatterns) {
    const match = cleanContent.match(pattern);
    if (match && match[2]) {
      let contentText = match[2].trim();
      // 清理正文中的多余内容
      contentText = cleanContentText(contentText);
      if (contentText && contentText.length > 10) {
        result.content = contentText;
        result.description = contentText.substring(0, 200);
        break;
      }
    }
  }

  // 如果上面的方法都没找到，尝试直接提取标签前的所有内容
  if (!result.content) {
    const tagsIndex = cleanContent.indexOf('\n#');
    if (tagsIndex > 0) {
      let rawContent = cleanContent.substring(0, tagsIndex);
      // 移除标题行
      rawContent = rawContent.replace(/^[^\n]+\n/, '').trim();
      result.content = cleanContentText(rawContent);
      result.description = result.content.substring(0, 200);
    }
  }

  // ========== 4. 提取标签 ==========
  // 格式：#标签名
  const tagsPatterns = [
    /#([\u4e00-\u9fa5\w]+)/g,
  ];
  for (const pattern of tagsPatterns) {
    let match;
    while ((match = pattern.exec(cleanContent)) !== null) {
      if (!result.tags.includes(match[1])) {
        result.tags.push(match[1]);
      }
    }
  }

  // ========== 5. 提取地点 ==========
  // 格式：01-14 上海
  const locationMatch = cleanContent.match(/(\d{2}-\d{2}\s+[\u4e00-\u9fa5\s]+)/);
  if (locationMatch) {
    result.location = locationMatch[1].trim();
  }

  // ========== 6. 提统计数据 ==========
  // 格式：40 12 5 (点赞 收藏 评论)
  const statsMatch = cleanContent.match(/(\d+)\s+(\d+)\s+(\d+)/);
  if (statsMatch) {
    result.stats = {
      likes: parseInt(statsMatch[1]) || 0,
      comments: parseInt(statsMatch[2]) || 0,
      shares: parseInt(statsMatch[3]) || 0,
    };
  }

  result.method = 'jina_reader';
  return result;
}

/**
 * 清理正文内容，移除页面元素
 */
function cleanContentText(text) {
  const junkPatterns = [
    /\*\s*发现/,
    /\*\s*发布/,
    /\*\s*通知/,
    /登录$/,
    /我$/,
    /关注/,
    /\d+:\d+\s*\d+:\d+/, // 时间码
    /[\d.]+x\s*倍速/,
    /请\s+刷新\s+试试/,
    /内容可能使用AI技术生成/,
    /加载中/,
    /去首页.*?笔记/,
    /登录后评论/,
    /发送\s+取消/,
    /我要申诉/,
    /温馨提示/,
    /沪ICP备.*/,
    /营业执照.*/,
    /公网安备.*/,
    /增值电信.*/,
    /医疗器械.*/,
    /互联网药品.*/,
    /违法不良.*/,
    /举报中心.*/,
    /有害信息.*/,
    /自营经营者.*/,
    /网络文化.*/,
    /个性化推荐.*/,
    /行吟信息.*/,
    /地址：.*/,
    /电话：.*/,
    /©\s*\d{4}/,
    /更多$/,
    /活动$/,
    /创作服务$/,
    /直播管理$/,
    /电脑直播助手$/,
    /专业号$/,
    /推广合作$/,
    /蒲公英$/,
    /商家入驻$/,
    /MCN入驻/,
    /举报$/,
  ];

  let cleaned = text;
  for (const pattern of junkPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 清理多余的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * 从 URL 提取笔记 ID
 */
async function extractNoteId(url) {
  try {
    const urlObj = new URL(url);

    // 标准格式：https://www.xiaohongshu.com/explore/ID
    const exploreMatch = urlObj.pathname.match(/\/explore\/([a-f0-9]+)/i);
    if (exploreMatch) {
      return exploreMatch[1];
    }

    // 短链接格式：https://xhslink.com/XXXX
    // 直接返回路径作为 ID
    if (urlObj.hostname.includes('xhslink.com')) {
      const pathId = urlObj.pathname.replace(/^\//, '').replace(/\//g, '');
      return pathId || 'unknown';
    }

    // 其他格式
    return urlObj.pathname.split('/').pop() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 验证是否是小红书 URL
 */
function isValidXiaohongshuUrl(url) {
  try {
    const urlObj = new URL(url);
    const validHosts = [
      'xiaohongshu.com',
      'www.xiaohongshu.com',
      'xhslink.com',
      'www.xhslink.com',
    ];
    return validHosts.some(host => urlObj.hostname === host);
  } catch {
    return false;
  }
}

/**
 * 简单的 HTML 解码
 */
function simpleDecodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
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
