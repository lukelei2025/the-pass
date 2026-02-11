/**
 * Cloudflare Worker: 服务端标题抓取代理
 * 逻辑完全复刻 Vite Plugin，但在边缘节点运行
 */

const USER_AGENTS = [
    // 策略 1: Googlebot UA — 优先尝试！
    // 对于飞书/Notion 等 SPA，Googlebot 能直接获取 SSR 内容，速度极快且无跳转
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
    // 策略 2: 浏览器 UA — 备用
    // 适合微信、知乎等对 Googlebot 屏蔽但允许浏览器的传统网站
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function decodeEntities(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function extractTitle(html) {
    if (!html) return null;

    // 1. og:title (最可靠)
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) return decodeEntities(ogMatch[1].trim());

    // 2. WeChat 特有: var msg_title 或 window.msg_title
    // 兼容: var msg_title = '...'; window.msg_title = '...'; window.msg_title = window.title = '...';
    const msgMatch = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
    if (msgMatch && msgMatch[1]) return decodeEntities(msgMatch[1].trim());

    // 3. <title> 标签
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) return decodeEntities(titleMatch[1].trim());

    // 4. 第一个 <h1>
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
        const clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
        if (clean) return decodeEntities(clean);
    }

    return null;
}

export default {
    async fetch(request, env, ctx) {
        // 处理 CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        const url = new URL(request.url);
        const targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: "Missing url parameter" }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        let lastDebugHtml = "";

        // 依次尝试每种 User-Agent
        for (const ua of USER_AGENTS) {
            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        "User-Agent": ua,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
                        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    },
                    redirect: "follow",
                    cf: {
                        cacheTtl: 3600, // 缓存 1 小时
                        cacheEverything: true,
                    },
                });

                if (!response.ok) continue;

                const html = await response.text();
                lastDebugHtml = html.substring(0, 500); // Capture for debug
                const title = extractTitle(html);

                if (title) {
                    // 检查是否为无效标题 (如微信对 Googlebot 返回 404/拦截图)
                    if (title.includes("该页面不存在") || title.includes("访问受限") || title.includes("Just a moment")) {
                        // 继续尝试下一个 UA
                        continue;
                    }
                    return new Response(JSON.stringify({ title }), {
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                            "Cache-Control": "public, max-age=3600"
                        },
                    });
                }
            } catch (err) {
                // Ignore error, try next UA
            }
        }

        return new Response(JSON.stringify({ title: null }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    },
};
