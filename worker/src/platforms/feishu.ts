import { BasePlatform, TitleResult, Env } from './base';
import { USER_AGENTS } from '../config/constants';
import { extractTitleFromHtml } from '../utils/html';

export class FeishuPlatform extends BasePlatform {
    getName(): string {
        return 'feishu';
    }

    canHandle(url: string): boolean {
        const hostname = this.extractHostname(url);
        return hostname.includes('feishu.cn') || hostname.includes('feishu.com');
    }

    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        try {
            const cleanUrl = url.replace(/^https?:\/\//, '');
            const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
            const headers: Record<string, string> = {
                'User-Agent': USER_AGENTS.GENERIC,
            };
            if (env.JINA_API_KEY) {
                headers['Authorization'] = `Bearer ${env.JINA_API_KEY}`;
            }

            const response = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(15000) } as any);
            if (!response.ok) {
                return { title: null, author: '' };
            }

            const content = await response.text();
            const author = this.extractAuthor(content);
            const title = this.extractTitle(content);

            if (title) {
                return { title, author };
            }
        } catch {
        }

        return await this.fetchFromHtml(url);
    }

    private async fetchFromHtml(url: string): Promise<TitleResult> {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENTS.GENERIC },
                redirect: 'follow',
                signal: AbortSignal.timeout(15000),
            } as any);
            if (!response.ok) {
                return { title: null, author: '' };
            }

            const html = await response.text();
            const title = extractTitleFromHtml(html);
            if (!title) {
                return { title: null, author: '' };
            }

            return { title, author: '' };
        } catch {
            return { title: null, author: '' };
        }
    }

    private extractAuthor(content: string): string {
        const authorPatterns = [
            /创建者[：:]\s*([^\n\r]+)/i,
            /作者[：:]\s*([^\n\r]+)/i,
            /by\s+([^\n\r]+)/i,
            /文档所有者[：:]\s*([^\n\r]+)/i,
        ];

        for (const pattern of authorPatterns) {
            const match = content.match(pattern);
            if (match && match[1]?.trim()) {
                return match[1].trim();
            }
        }

        return '';
    }

    private extractTitle(content: string): string | null {
        const firstLine = content.split('\n')[0]?.trim();
        if (!firstLine) {
            return null;
        }

        let title = firstLine.replace(/^Title:\s*/i, '').trim();
        title = title.replace(/\s*-\s*Feishu\s*Docs$/i, '').trim();
        if (!title) {
            return null;
        }

        if (title.length > 100) {
            return title.substring(0, 100);
        }

        return title;
    }

    private extractHostname(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.toLowerCase();
        } catch {
            return '';
        }
    }
}
