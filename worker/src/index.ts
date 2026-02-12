/**
 * Cloudflare Worker: 服务端标题抓取代理
 * 
 * 功能：
 * 1. 通用网页标题抓取 (基于 User-Agent)
 * 2. Twitter/X 专用增强抓取 (基于 Jina Reader / Nitter / Meta)
 * 
 * 逻辑整合了原有的通用抓取能力和 twitter-scraper-worker.js 的专用解析能力。
 */

import { getXiaohongshuInfo } from './xiaohongshu';
import { CLASSIFICATION_RULES } from './classification-rules';

// ==========================================
// 2. 通用网页抓取逻辑 (Fallback & Default)
// ==========================================

// 定义 Env 接口
export interface Env {
    TWITTER_BEARER_TOKEN?: string; // 保留兼容性，暂不使用
    GLM_API_KEY?: string;
    JINA_API_KEY?: string;
    CACHE?: KVNamespace;
}

// 通用 User-Agent 列表
const USER_AGENTS = [
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Twitter Scraper 配置
const CONFIG = {
    CACHE_TTL: 300, // 缓存5分钟
    TIMEOUT: 10000, // 10秒超时
    USER_AGENT: 'Mozilla/5.0 (compatible; TwitterScraper/1.0)',
};

/**
 * 通用工具函数: HTML 实体解码
 */
function decodeEntities(text: string | null) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

/**
 * 通用工具函数: 提取网页标题
 */
function extractTitle(html: string | null) {
    if (!html) return null;

    let title: string | null = null;

    // 1. og:title (最可靠)
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
        title = decodeEntities(ogMatch[1].trim());
    }

    // 2. WeChat 特有
    if (!title) {
        const msgMatch = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
        if (msgMatch && msgMatch[1]) title = decodeEntities(msgMatch[1].trim());
    }



    // 3. <title> 标签
    if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            title = decodeEntities(titleMatch[1].trim());
        }
    }

    // 4. Determine final title
    if (!title) {
        // ... h1 fallback ...
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match && h1Match[1]) {
            const clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
            if (clean) title = decodeEntities(clean);
        }
    }

    // Cleanup for Xiaohongshu specifically (remove suffix)
    if (title && (html.includes('xiaohongshu.com') || html.includes('Red - The Little Red Book'))) {
        title = title.replace(/\s*-\s*小红书$/, '');
    }

    return title;
}

/**
 * Twitter 专用: 从 URL 提取 ID
 */
function extractTweetId(url: string) {
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
 * Twitter 专用: Jina Reader 策略
 */
async function methodJinaReader(tweetUrl: string, apiKey: string | null | undefined = null) {
    try {
        const cleanUrl = tweetUrl.replace(/^https?:\/\//, '');
        const jinaUrl = `https://r.jina.ai/http://${cleanUrl}`;

        const headers: Record<string, string> = {
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
            return { error: 'Rate limit exceeded' };
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
    } catch (error: any) {
        return { error: error.message };
    }
}

/**
 * Twitter 专用: Nitter 策略
 */
async function methodNitter(tweetUrl: string, _apiKey?: any) {
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

            return { author, username, title, method: 'nitter' };
        } catch (error) {
            continue;
        }
    }
    return { error: 'All nitter instances failed' };
}

/**
 * Twitter 专用: Meta 标签策略
 */
async function methodMetaTags(tweetUrl: string, _apiKey?: any) {
    try {
        const response = await fetch(tweetUrl, {
            headers: { 'User-Agent': CONFIG.USER_AGENT },
            signal: AbortSignal.timeout(CONFIG.TIMEOUT),
            redirect: 'follow',
        });

        if (response.status !== 200) return { error: `HTTP ${response.status}` };

        const html = await response.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

        let titleText = titleMatch ? titleMatch[1] : '';
        if (!titleText && descMatch) titleText = descMatch[1];

        const authorMatch = titleText.match(/(.+?)\s+(?:on X|on Twitter)/);
        const author = authorMatch ? authorMatch[1] : 'unknown';

        const urlMatch = tweetUrl.match(/(?:twitter|x)\.com\/(\w+)\/status/);
        const username = urlMatch ? urlMatch[1] : author;

        const contentMatch = titleText.match(/"(.+)"/);
        if (contentMatch) titleText = contentMatch[1];

        return { author, username, title: titleText, method: 'meta_tags' };
    } catch (error: any) {
        return { error: error.message };
    }
}

/**
 * Twitter 专用: 聚合获取逻辑
 */
async function getTweetInfo(tweetUrl: string, apiKey: string | null | undefined = null) {
    const methods = [
        methodJinaReader, // 优先使用 Jina
        methodNitter,     // 备用 Nitter
        methodMetaTags,   // 最后尝试 Meta 标签
    ];

    for (const method of methods) {
        try {
            const result = await method(tweetUrl, apiKey);
            if (result && !result.error && result.title) {
                return result;
            }
        } catch (error) {
            console.warn(`${method.name} failed:`, error);
        }
    }
    return null;
}

/**
 * 处理分类请求 (使用外部规则文件)
 */
async function handleClassify(request: Request, env: Env): Promise<Response> {
    try {
        const apiKey = env.GLM_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server misconfiguration: API key not found" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const body = await request.json() as any;
        const { content, metadata } = body;

        if (!content) {
            return new Response(JSON.stringify({ error: "Missing content" }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

        // Use the imported rules
        const prompt = `
${CLASSIFICATION_RULES}

用户原始输入: """${content.replace(/"/g, '\\"')}"""
${metadata?.isLink ? `(系统检测事实: 包含链接 ${metadata.originalUrl}, 标题 "${(metadata.title || '').replace(/"/g, '\\"')}")` : ''}

请严格遵守 JSON 格式返回，确保所有字符串内的双引号都经过转义（\"），不要包含 Markdown 标记：
{
  "reasoning": "你的思考过程...",
  "category": "category_key"
}
`;

        const response = await fetch(GLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'glm-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: "GLM API Failed", details: errorText }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const data = await response.json() as any;
        let rawContent = data.choices?.[0]?.message?.content?.trim();

        // Try to extract JSON from the response if it contains other text
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            rawContent = jsonMatch[0];
        }

        rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

        let result;
        try {
            result = JSON.parse(rawContent);
        } catch (e) {
            result = {
                category: 'others',
                reasoning: 'JSON Parse Error, Raw: ' + rawContent
            };
        }

        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Internal Error", details: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}

/**
 * 主逻辑
 */
export default {
    async fetch(request: Request, env: Env, ctx: any) {
        // 处理 CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        const url = new URL(request.url);
        const targetUrl = url.searchParams.get("url");

        // 如果是 POST 且没有 url 参数，走分类逻辑
        if (request.method === "POST" && !targetUrl) {
            return handleClassify(request, env);
        }

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: "Missing url parameter" }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // ==========================================
        // 1. Twitter / X 专用处理逻辑
        // ==========================================
        if (targetUrl.includes('x.com/') || targetUrl.includes('twitter.com/')) {
            const tweetId = extractTweetId(targetUrl);

            // 尝试从 KV 缓存读取
            if (tweetId && env.CACHE) {
                const cached = await env.CACHE.get(`tweet:${tweetId}`, 'json');
                if (cached) {
                    // @ts-ignore
                    const titleStr = `${cached.author}: "${cached.title}"`;
                    return new Response(JSON.stringify({ title: titleStr, cached: true }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" }
                    });
                }
            }

            // 获取信息
            const tweetInfo = await getTweetInfo(targetUrl, env.JINA_API_KEY);

            if (tweetInfo) {
                // 写入缓存
                if (tweetId && env.CACHE) {
                    ctx.waitUntil(env.CACHE.put(`tweet:${tweetId}`, JSON.stringify(tweetInfo), {
                        expirationTtl: CONFIG.CACHE_TTL,
                    }));
                }

                // 格式化为 App 期望的字符串格式: Author: "Title"
                const titleStr = `${tweetInfo.author}: "${tweetInfo.title}"`;
                return new Response(JSON.stringify({ title: titleStr }), {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600"
                    },
                });
            }
        }

        // ==========================================
        // 1.5 Xiaohongshu 专用处理逻辑
        // ==========================================
        if (targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhslink.com')) {
            const result = await getXiaohongshuInfo(targetUrl, env);

            if (result && !('error' in result)) {
                // Remove suffix just in case the parser didn't catch it (though it does)
                let cleanTitle = result.title.replace(/\s*-\s*小红书$/, '');

                // Format: "Author: Title"
                const titleStr = result.author ? `${result.author}: "${cleanTitle}"` : cleanTitle;

                return new Response(JSON.stringify({ title: titleStr }), {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600"
                    },
                });
            }
        }

        // ==========================================
        // 2. 通用网页抓取逻辑 (Fallback & Default)
        // ==========================================
        for (const ua of USER_AGENTS) {
            try {
                // Special handling for xhslink (needs mobile UA to redirect properly sometimes, or just follow redirects)
                const isXhsLink = targetUrl.includes('xhslink.com');
                const fetchHeaders = {
                    "User-Agent": isXhsLink
                        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
                        : ua,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                };

                const response = await fetch(targetUrl, {
                    headers: fetchHeaders,
                    redirect: "follow",
                    cf: { cacheTtl: 3600, cacheEverything: true },
                } as any);

                if (!response.ok) continue;

                // If it's a short link, the response.url might be the final URL
                const finalUrl = response.url;
                const html = await response.text();

                // Pass finalUrl to extractTitle if needed for logic dependent on URL
                const title = extractTitle(html);



                if (title && !title.includes("该页面不存在") && !title.includes("访问受限")) {
                    return new Response(JSON.stringify({ title }), {
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                            "Cache-Control": "public, max-age=3600"
                        },
                    });
                }
            } catch (err) {
                // Ignore
            }
        }

        return new Response(JSON.stringify({ title: null }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    },
};
