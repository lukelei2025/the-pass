
import * as functions from 'firebase-functions';
import axios from 'axios';
import * as cors from 'cors';

// Initialize CORS middleware
const corsHandler = cors({ origin: true });

// GLM-4 API URL
const GLM_API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';

interface ClassificationRequest {
    content: string;
    metadata?: any;
}

export const classifyContent = functions.https.onRequest(async (req, res) => {
    // Handle CORS
    return corsHandler(req, res, async () => {
        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        try {
            // Get API Key from Firebase Secrets
            // Note: User needs to set this using `firebase functions:secrets:set GLM_API_KEY`
            const apiKey = process.env.GLM_API_KEY;

            if (!apiKey) {
                console.error('GLM_API_KEY is not set');
                res.status(500).json({ error: 'Server misconfiguration: API key not found' });
                return;
            }

            const { content, metadata } = req.body as ClassificationRequest;

            if (!content) {
                res.status(400).json({ error: 'Missing content' });
                return;
            }

            // Construct the prompt (Logic moved from frontend to backend)
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

            const response = await axios.post(
                GLM_API_URL,
                {
                    model: 'glm-4',
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.1,
                    max_tokens: 2000,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                }
            );

            const data = response.data;
            let rawContent = data.choices?.[0]?.message?.content?.trim();

            // Clean up Markdown code blocks if present
            rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

            let result;
            try {
                result = JSON.parse(rawContent);
            } catch (e) {
                console.warn('JSON parse failed, downgrading to text match', rawContent);
                // Simple fallback if JSON parsing fails
                result = {
                    category: 'others',
                    reasoning: 'JSON Parse Error, Raw: ' + rawContent
                };
            }

            res.status(200).json(result);

        } catch (error: any) {
            console.error('Error calling GLM API:', error.response?.data || error.message);
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    });
});
