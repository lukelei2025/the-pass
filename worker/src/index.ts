/**
 * Cloudflare Worker - 统一标题抓取入口
 *
 * 路由到相应的平台处理器
 */

import { WeChatPlatform } from './platforms/wechat';
import { TwitterPlatform } from './platforms/twitter';
import { XiaohongshuPlatform } from './platforms/xiaohongshu';
import { DouyinPlatform } from './platforms/douyin';
import { FeishuPlatform } from './platforms/feishu';
import { GenericPlatform } from './platforms/generic';
import { createCorsHeaders, createOptionsResponse } from './utils/cors';
import { Env, TitleResult } from './platforms/base';
import { CLASSIFICATION_RULES } from './classification-rules';
import { CONFIG, USER_AGENTS } from './config/constants';

// 平台处理器列表（按优先级排序）
const PLATFORMS = [
    new WeChatPlatform(),
    new TwitterPlatform(),
    new XiaohongshuPlatform(),
    new DouyinPlatform(),
    new FeishuPlatform(),
    new GenericPlatform(), // 兜底
];

const GLM_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';
const GLM_CHAT_COMPLETIONS_URL = `${GLM_BASE_URL}/chat/completions`;

export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');
        const resolveOnly = url.searchParams.get('resolve') === '1';
        const debug = url.searchParams.get('debug') === '1';

        // 处理 OPTIONS 请求
        if (request.method === 'OPTIONS') {
            return createOptionsResponse();
        }

        // 如果是 POST 且没有 url 参数，则作为分类请求
        if (request.method === 'POST' && !targetUrl) {
            return handleClassify(request, env);
        }

        // 标题抓取请求：路由到对应平台
        if (!targetUrl) {
            return new Response(JSON.stringify({ title: null, author: null }), {
                status: 400,
                headers: createCorsHeaders(),
            });
        }

        if (request.method === 'GET' && resolveOnly) {
            const userAgent = targetUrl.includes('xhslink.com')
                ? USER_AGENTS.XIAOHOUGSHU
                : USER_AGENTS.GENERIC;
            try {
                const response = await fetch(targetUrl, {
                    headers: { 'User-Agent': userAgent },
                    redirect: 'follow',
                } as any);
                const resolvedUrl = response.url || targetUrl;
                return new Response(JSON.stringify({ resolvedUrl }), {
                    headers: createCorsHeaders(),
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ resolvedUrl: targetUrl, error: error.message }), {
                    headers: createCorsHeaders(),
                });
            }
        }

        // 遍历平台处理器，返回第一个能处理的
        for (const platform of PLATFORMS) {
            if (platform.canHandle(targetUrl)) {
                const result = await platform.fetchTitle(targetUrl, env);
                const response = debug
                    ? JSON.stringify(result)
                    : (result.title
                        ? JSON.stringify(result)
                        : JSON.stringify({ title: null, author: null }));
                return new Response(response, {
                    headers: {
                        ...createCorsHeaders(),
                        'Cache-Control': result.cached ? 'public, max-age=3600' : 'no-cache',
                    },
                });
            }
        }

        // 不应该到这里，因为 GenericPlatform.canHandle() 永远返回 true
        return new Response(JSON.stringify({ error: 'No platform handler found' }), {
            status: 500,
            headers: createCorsHeaders(),
        });
    }
};

/**
 * 处理分类请求
 */
async function handleClassify(request: Request, env: Env): Promise<Response> {
    try {
        const body = await request.json() as any;
        const { content, metadata } = body;

        if (!content) {
            return new Response(JSON.stringify({ error: 'Missing content' }), {
                status: 400,
                headers: createCorsHeaders(),
            });
        }

        // 调用 LLM 进行分类
        const glmApiKey = env.GLM_API_KEY;
        if (!glmApiKey) {
            return new Response(JSON.stringify({ error: 'GLM API key not configured' }), {
                status: 500,
                headers: createCorsHeaders(),
            });
        }

        const prompt = `
${CLASSIFICATION_RULES}

---

Input Content / 用户输入原文:
"""
${content}
"""

Metadata / 元数据:
${JSON.stringify(metadata || {}, null, 2)}

请严格遵守 JSON 格式返回，确保所有字符串内的双引号都经过转义（\\"），不要包含 Markdown 标记：
{
  "category": "category_key"
}
`;

        let response: Response;
        try {
            response = await fetch(GLM_CHAT_COMPLETIONS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${glmApiKey}`,
                },
                body: JSON.stringify({
                    model: 'glm-4',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    max_tokens: 2000,
                }),
                signal: AbortSignal.timeout(CONFIG.TIMEOUT),
            });
        } catch (error: any) {
            const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError';
            return new Response(JSON.stringify({
                error: isTimeout ? 'GLM API Timeout' : 'GLM API Request Failed',
                details: error?.message || String(error),
            }), {
                status: isTimeout ? 504 : 502,
                headers: createCorsHeaders(),
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: 'GLM API Failed', details: errorText }), {
                status: response.status >= 500 ? 502 : response.status,
                headers: createCorsHeaders(),
            });
        }

        const data = await response.json() as any;
        let rawContent = data.choices?.[0]?.message?.content?.trim();

        // 提取 JSON
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            rawContent = jsonMatch[0];
        }

        rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '');

        let result;
        try {
            result = JSON.parse(rawContent);
        } catch (e) {
            result = {
                category: 'others',
                reasoning: 'JSON Parse Error, Raw: ' + rawContent,
            };
        }

        const allowedCategories = new Set(['ideas', 'work', 'personal', 'external', 'others']);
        if (!result || typeof result.category !== 'string' || !allowedCategories.has(result.category)) {
            result = {
                category: metadata?.isLink ? 'external' : 'others',
                reasoning: 'Invalid category from model, fallback applied',
            };
        }

        return new Response(JSON.stringify(result), {
            headers: createCorsHeaders(),
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), {
            status: 500,
            headers: createCorsHeaders(),
        });
    }
}
