/**
 * HTML 解析工具
 */

/**
 * 解码 HTML 实体
 */
export function decodeEntities(text: string | null): string {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * 从 HTML 中提取标题（多种方法）
 */
export function extractTitleFromHtml(html: string): string | null {
    if (!html) return null;

    let title: string | null = null;

    // 方法 1: og:title
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
        title = decodeEntities(ogMatch[1]).trim();
    }

    // 方法 2: <title> 标签
    if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            title = decodeEntities(titleMatch[1]).trim();
        }
    }

    // 方法 3: h1 标签
    if (!title) {
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match && h1Match[1]) {
            let clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
            if (clean) {
                title = decodeEntities(clean);
            }
        }
    }

    return title;
}
