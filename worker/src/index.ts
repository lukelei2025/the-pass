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

function extractTitle(html: string | null) {
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

/**
 * 专门处理 Twitter/X 的 oEmbed 抓取
 * 官方文档: https://developer.twitter.com/en/docs/twitter-for-websites/oembed-api
 */
async function fetchTwitterOEmbed(url: string): Promise<string | null> {
    try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
        console.log(`Fetching Twitter oEmbed for: ${url}`);
        const response = await fetch(oembedUrl, {
            headers: {
                // 必须添加 UA，否则 Twitter 可能拒绝请求
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });

        if (!response.ok) {
            const errorMsg = `Twitter oEmbed failed: ${response.status} ${response.statusText}`;
            console.warn(`[Debug] ${errorMsg}`);
            return `[Debug Error] ${errorMsg}`;
        }

        const data = await response.json() as any;
        const authorName = data.author_name;
        const html = data.html || '';

        // 从 HTML blockquote 中提取推文内容
        // 格式通常为: <p ...>Content</p>&mdash; Author (@handle) ...
        let content = html.replace(/<[^>]+>/g, ' ').trim();

        // 清理末尾的作者签名和日期 (从 &mdash; 或 — 开始截断)
        content = content.replace(/(&mdash;|—).+$/s, '').trim();

        // Decode HTML entities in content
        content = content
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');

        // 尝试提取 t.co 链接并解析目标标题
        // HTML 中通常是 <a href="https://t.co/...">
        const tcoMatch = html.match(/href="(https:\/\/t\.co\/[^"]+)"/);
        if (tcoMatch && tcoMatch[1]) {
            const tcoUrl = tcoMatch[1];
            try {
                console.log(`[Debug] Resolving t.co link: ${tcoUrl}`);
                const linkedResponse = await fetch(tcoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    },
                    redirect: 'follow'
                });
                if (linkedResponse.ok) {
                    const linkedHtml = await linkedResponse.text();
                    const linkedTitle = extractTitle(linkedHtml);
                    if (linkedTitle) {
                        console.log(`[Debug] Resolved linked title: ${linkedTitle}`);
                        // 如果推文内容仅仅是链接，则直接使用文章标题
                        // 否则保留一些推文文本
                        const isJustLink = content.includes('https://t.co/') && content.length < 40;
                        if (isJustLink) {
                            return `${authorName}: "${linkedTitle}"`;
                        } else {
                            // 替换内容中的 t.co 链接为 标题
                            // 这里简单追加
                            return `${authorName}: "${linkedTitle}"`;
                        }
                    }
                }
            } catch (err) {
                console.warn(`[Debug] Failed to resolve t.co link:`, err);
            }
        }

        if (authorName && content) {
            const shortContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
            return `${authorName}: "${shortContent}"`;
        }

        return data.title || (authorName ? `Tweet by ${authorName}` : "No title found in oEmbed");
    } catch (e: any) {
        const errorMsg = `Twitter oEmbed Exception: ${e.message}`;
        console.error(`[Debug] ${errorMsg}`);
        return `[Debug Error] ${errorMsg}`;
    }
}


export interface Env {
    GLM_API_KEY: string;
}

const GLM_API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';

async function handleClassify(request: Request, env: Env) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

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

        // Construct the prompt
        const prompt = `
你是一个个人信息管理助手。请分析用户输入的内容，将其归类到以下类别之一：

- ideas: 灵感、想法、随笔、笔记
- work: 工作任务、职业发展、项目相关
- personal: 个人生活、健康、家庭、娱乐（如电影、游戏、小说）
- external: 外部链接、文章、视频、资源
- others: 无法明确归类的其他内容

**分类规则：**
1. 如果内容是URL链接，优先归类为 'external'。
2. 包含 "买"、"吃"、"看" (电影/书) 等生活向动词，归类为 'personal'。
3. 包含 "会议"、"报告"、"代码"、"项目"、"客户" 等工作向词汇，归类为 'work'。
4. 短语、碎片化想法、备忘录，归类为 'ideas'。

请进行一步步思考 (Chain of Thought)，然后返回 JSON 格式结果。

用户原始输入:
"""
${content}
"""

${metadata?.isLink ? `(系统检测事实: 包含链接 ${metadata.originalUrl}, 标题 "${metadata.title || ''}")` : ''}

请严格遵守 JSON 格式返回，不要包含 Markdown 标记：
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
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.1,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GLM API Error:', errorText);
            return new Response(JSON.stringify({ error: "GLM API Failed", details: errorText }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const data = await response.json() as any;
        let rawContent = data.choices?.[0]?.message?.content?.trim();

        // Clean up Markdown code blocks
        rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

        let result;
        try {
            result = JSON.parse(rawContent);
        } catch (e) {
            console.warn('JSON parse failed', rawContent);
            result = {
                category: 'others',
                reasoning: 'JSON Parse Error, Raw: ' + rawContent
            };
        }

        return new Response(JSON.stringify(result), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Internal Error", details: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}

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

        // 如果 content-type 是 json 或者是 /classify 路径，则走分类逻辑
        // 但为了简单，如果 url 参数不存在且是 POST，我们就认为是分类请求
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

        // 特殊处理 Twitter / X
        if (targetUrl.includes('x.com/') || targetUrl.includes('twitter.com/')) {
            const twitterTitle = await fetchTwitterOEmbed(targetUrl);
            if (twitterTitle) {
                return new Response(JSON.stringify({ title: twitterTitle }), {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600"
                    },
                });
            }
            // 如果 oembed 失败，继续尝试通用抓取（虽然大概率也会失败）
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
                } as any); // Type assertion for cf property

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
