import type { Item } from '../types';

/**
 * 导出收藏条目为 CSV (Excel 兼容)
 * 
 * 表头: 日期、标题、作者、笔记、标签、分类、平台
 * - 非外部链接条目: 标题 = content, 作者 = 空
 * - 外部链接条目: 标题 = title || content, 作者 = source
 */
export function exportItemsToCSV(items: Item[], categoryLabels: Record<string, string>) {
    const headers = ['日期', '标题', '作者', '笔记', '标签', '分类', '平台', '链接'];

    const rows = items.map(item => {
        const isExternalLink = !!item.originalUrl;
        const date = new Date(item.createdAt).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const title = isExternalLink ? (item.title || item.content) : item.content;
        const author = isExternalLink ? (item.source || '') : '';
        const notes = item.details || '';
        const tags = (item.tags || []).join(', ');
        const category = categoryLabels[item.category] || item.category;
        const platform = isExternalLink ? extractPlatform(item.originalUrl!) : '';
        const url = isExternalLink ? item.originalUrl! : '';

        return [date, title, author, notes, tags, category, platform, url];
    });

    // Build CSV with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stash_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 从 URL 中提取平台名称
 */
function extractPlatform(url: string): string {
    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        const platformMap: Record<string, string> = {
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'xiaohongshu.com': '小红书',
            'xhslink.com': '小红书',
            'weixin.qq.com': '微信',
            'mp.weixin.qq.com': '微信公众号',
            'douyin.com': '抖音',
            'bilibili.com': 'B站',
            'youtube.com': 'YouTube',
            'youtu.be': 'YouTube',
            'github.com': 'GitHub',
            'feishu.cn': '飞书',
            'zhihu.com': '知乎',
            'weibo.com': '微博',
            'notion.so': 'Notion',
            'medium.com': 'Medium',
        };
        for (const [domain, name] of Object.entries(platformMap)) {
            if (hostname.includes(domain)) return name;
        }
        return hostname;
    } catch {
        return '';
    }
}
