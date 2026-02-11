
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        // CORS 预检请求处理
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            });
        }

        if (!targetUrl) {
            return jsonResponse({ error: '请提供 url 参数' }, 400);
        }

        // 验证是否为微信链接
        if (!targetUrl.includes('mp.weixin.qq.com')) {
            return jsonResponse({ error: '仅支持微信公众号链接' }, 400);
        }

        try {
            const response = await fetch(targetUrl, {
                headers: {
                    // 模拟微信内置浏览器
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.38.2401(0x2800265F) Process/tools WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                }
            });

            const html = await response.text();

            // 提取 og:title
            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);

            // 提取公众号名称
            const accountMatch = html.match(/var\s+nickname\s*=\s*"([^"]+)"/i) ||
                html.match(/"nick_name"\s*:\s*"([^"]+)"/i);

            if (titleMatch) {
                // 清理标题（og:title 会包含完整正文，只取第一行）
                let fullContent = titleMatch[1];
                try {
                    // 简单的反转义处理
                    fullContent = fullContent
                        .replace(/\\n/g, '\n')
                        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>');
                } catch (e) {
                    // ignore
                }

                const title = fullContent.split('\n')[0].trim();

                return jsonResponse({
                    success: true,
                    title: title,
                    account: accountMatch ? accountMatch[1] : null,
                    url: targetUrl
                });
            }

            return jsonResponse({ error: '无法提取标题，可能文章不存在或已被删除' }, 404);

        } catch (err) {
            return jsonResponse({ error: '请求失败: ' + err.message }, 500);
        }
    }
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
        }
    });
}
