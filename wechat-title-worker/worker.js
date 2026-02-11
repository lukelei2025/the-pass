
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.38.2401(0x2800265F) Process/tools WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                }
            });

            const html = await response.text();

            // 提取标题
            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);

            let title = null;
            if (titleMatch) {
                title = titleMatch[1].split('\\n')[0].trim();
                // 简单的反转义处理
                try {
                    title = title
                        .replace(/\\n/g, '\n')
                        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>');
                } catch (e) {
                    // ignore
                }
            }

            // 📝 提取作者信息的多种方式
            const authorInfo = extractAuthorInfo(html);

            return jsonResponse({
                success: true,
                title: title,
                author: authorInfo,
                url: targetUrl
            });

        } catch (err) {
            return jsonResponse({ error: '请求失败: ' + err.message }, 500);
        }
    }
};

function extractAuthorInfo(html) {
    const result = {
        account: null,      // 公众号名称
        author: null,       // 文章作者
    };

    // 1. 公众号名称 - 多重策略
    const accountMatch1 = html.match(/var\s+nickname\s*=\s*"([^"]+)"/i);
    const accountMatch2 = html.match(/"nick_name"\s*:\s*"([^"]+)"/i);
    const accountMatch3 = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i);

    // DOM 匹配策略
    const domMatch = html.match(/<strong[^>]*class="[^"]*profile_nickname[^"]*"[^>]*>(.*?)<\/strong>/i) ||
        html.match(/id="js_name">\s*([^<]+?)\s*<\/a>/i) ||
        html.match(/id="js_name">\s*([^<]+?)\s*<\/strong>/i);

    result.account = accountMatch1?.[1] || accountMatch2?.[1] || accountMatch3?.[1] || domMatch?.[1]?.trim() || null;

    // 2. 文章作者 (msg_author 字段)
    const authorMatch1 = html.match(/var\s+msg_author\s*=\s*"([^"]+)"/i);
    const authorMatch2 = html.match(/"author"\s*:\s*"([^"]+)"/i);
    result.author = authorMatch1?.[1] || authorMatch2?.[1] || null;

    // 4. 尝试从页面内容中提取"作者："标签后的文字
    const contentAuthorMatch = html.match(/<span\s+class="rich_title_meta[^"]*">[^<]*作者[：:]\s*([^<]+)<\/span>/i);
    if (contentAuthorMatch) {
        result.author = result.author || contentAuthorMatch[1].trim();
    }

    // 清理空值和 HTML 实体
    Object.keys(result).forEach(key => {
        if (!result[key]) {
            delete result[key];
        } else {
            result[key] = result[key].replace(/&nbsp;/g, ' ').trim();
        }
    });

    return Object.keys(result).length > 0 ? result : null;
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
        }
    });
}
