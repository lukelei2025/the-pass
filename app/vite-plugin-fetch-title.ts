/**
 * Vite Plugin: 服务端标题抓取代理
 * 
 * 解决浏览器 CORS 限制，通过 Vite 开发服务器的 Node.js 环境
 * 代理请求目标网页并提取标题信息。
 * 
 * 双 User-Agent 策略：
 *   1. 浏览器 UA (适用于微信公众号等传统网站)
 *   2. Googlebot UA (适用于飞书/Notion 等 SPA，它们对爬虫做 SSR)
 * 
 * 端点: GET /api/fetch-title?url=<encoded_url>
 * 返回: { title?: string, error?: string }
 */
import type { Plugin } from 'vite';

const USER_AGENTS = [
    // 策略 1: 浏览器 UA — 适合微信、知乎等传统 SSR 网站
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // 策略 2: Googlebot UA — 适合飞书、Notion 等 SPA（对爬虫返回 SSR 页面）
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
];

/**
 * 从 HTML 字符串中提取标题
 */
function extractTitle(html: string): string | null {
    // 1. og:title (最可靠的结构化元数据)
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) return decodeEntities(ogMatch[1].trim());

    // 2. WeChat 特有: msg_title (兼容 var msg_title 和 window.msg_title)
    const msgMatch = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
    if (msgMatch?.[1]) return decodeEntities(msgMatch[1].trim());

    // 3. <title> 标签 (必须非空)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]?.trim()) return decodeEntities(titleMatch[1].trim());

    // 4. 第一个 <h1>
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match?.[1]) {
        const clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
        if (clean) return decodeEntities(clean);
    }

    return null;
}

function decodeEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

export function fetchTitlePlugin(): Plugin {
    return {
        name: 'fetch-title-proxy',
        configureServer(server) {
            server.middlewares.use('/api/fetch-title', async (req, res) => {
                const url = new URL(req.url || '', 'http://localhost');
                const targetUrl = url.searchParams.get('url');

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');

                if (!targetUrl) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Missing url parameter' }));
                    return;
                }

                // 依次尝试每种 User-Agent
                for (const ua of USER_AGENTS) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);

                        const response = await fetch(targetUrl, {
                            signal: controller.signal,
                            headers: {
                                'User-Agent': ua,
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                            },
                            redirect: 'follow',
                        });

                        clearTimeout(timeoutId);
                        if (!response.ok) continue;

                        const html = await response.text();
                        const title = extractTitle(html);

                        if (title) {
                            res.end(JSON.stringify({ title }));
                            return;
                        }
                        // 没提取到标题，尝试下一个 UA
                    } catch {
                        // 请求失败，尝试下一个 UA
                    }
                }

                // 所有策略都失败
                res.end(JSON.stringify({ title: null }));
            });
        },
    };
}
