import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getRemainingTime, formatRemainingTime, mapCategory } from '../lib/constants';
import { classifyContent } from '../lib/llm';
import type { Category, ContentType } from '../types';
import ItemCard from '../components/ItemCard';
import { useTranslation } from '../hooks/useTranslation';

export default function WorkbenchView() {
  const { items, addItem, settings } = useStore();
  const [inputText, setInputText] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const { t } = useTranslation();

  const pendingItems = items.filter(item => item.status === 'pending');
  // Group items by NEW category keys, mapping old ones on the fly
  const itemsByCategory: Record<Category, typeof pendingItems> = {
    ideas: [], work: [], personal: [], external: [], others: [],
  };
  pendingItems.forEach(item => {
    const safeCat = mapCategory(item.category);
    itemsByCategory[safeCat].push(item);
  });

  const handleAddItem = async () => {
    if (!inputText.trim()) return;
    setIsClassifying(true);

    const { category, metadata } = await classifyContent(inputText, {
      enabled: settings.llmAutoClassify,
    });

    const type: ContentType = metadata.isLink ? 'link' : 'text';

    // 修正：分离 Title 和 Content (User Note)
    let title: string | undefined = undefined;
    let finalContent = inputText;

    if (metadata.isLink) {
      if (metadata.title) {
        title = metadata.title; // 链接标题存入 title
      }

      // 提取用户在 URL 之外写的文字作为 Note
      let userText = inputText
        .replace(/(https?:\/\/[^\s]+)/g, '')  // 去掉链接
        .replace(/复制后打开.*$/s, '')         // 去掉平台噪音
        .replace(/复制此链接.*$/s, '')
        .replace(/打开.*查看.*$/s, '')
        .replace(/#[^\s]+/g, '')              // 去掉 hashtags
        .trim();

      // 如果有用户写的文字，存为 content；否则 content 为空字符串或保留原始输入（这里选择存空，让 content 纯粹为笔记）
      // 实际上，为了兼容性，如果 content 为空但有 title，列表显示 title。
      // 但为了 edit 方便，content 应该是用户的 note。

      if (userText) {
        // Dedup: Check if userText is just a copy of the title (common in share text)
        const normalize = (str: string) => str.replace(/[\s\p{P}]+/gu, '').toLowerCase();

        const cleanUserText = normalize(userText);
        const cleanTitle = title ? normalize(title) : '';

        // Strategy: If the note is contained in the title, or the title is contained in the note,
        // AND the user didn't explicitly write something different (heuristic), discard it.
        // For Xiaohongshu specifically, share text often equals title.
        const isDuplicate = cleanTitle && (cleanUserText.includes(cleanTitle) || cleanTitle.includes(cleanUserText));

        // Special Case: Xiaohongshu often includes long intro text in clipboard share.
        // User explicitly requested to hide this "gray introduction text".
        const isXiaohongshu = metadata.platform === '小红书';

        if (isXiaohongshu) {
          finalContent = ''; // Aggressively clear for Xiaohongshu to avoid clutter
        } else if (!isDuplicate) {
          finalContent = userText;
        } else {
          finalContent = ''; // Filter out redundant text
        }
      } else {
        // If no user note, Content is empty
        finalContent = '';
      }
    } else {
      // 纯文本：Title 也就是 Content 的一部分？或者 Title 为空
      // 纯文本通常没有 Title，内容就是 Content
      title = undefined;
      finalContent = inputText;
    }

    // Fallback: 如果是链接但没抓取到 title， content 应该是 inputText 还是 url?
    if (metadata.isLink && !title) {
      // 没抓到标题，content 也就是原始输入（包含 URL）
      finalContent = inputText;
    }

    await addItem({
      content: finalContent,
      type,
      category,
      source: metadata.isLink ? (metadata.source || metadata.content) : undefined,
      originalUrl: metadata.isLink ? (metadata.originalUrl || metadata.content) : undefined,
      status: 'pending',
      title,
    });

    setInputText('');
    setIsClassifying(false);
  };

  const pendingCount = pendingItems.length;
  const llmConfigured = settings.llmAutoClassify;

  return (
    <div className="space-y-8 pb-20">
      {/* Desktop Centered Input */}
      <div className="max-w-2xl mx-auto space-y-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.workbench.inputPlaceholder}
          className="macos-input w-full p-3 resize-none min-h-[50px] md:min-h-[80px]"
          rows={1}
          disabled={isClassifying}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleAddItem();
            }
          }}
        />
        <div className="flex justify-between items-center px-1">
          <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${llmConfigured ? 'text-[var(--color-green)]' : 'text-[var(--color-ink-tertiary)]'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${llmConfigured ? 'bg-[var(--color-green)]' : 'bg-[var(--color-ink-tertiary)]'}`} />
            {isClassifying ? t.workbench.classifying : (llmConfigured ? t.workbench.autoClassifyOn : t.workbench.autoClassifyOff)}
          </div>
          <span className="text-[11px] font-medium text-[var(--color-ink-tertiary)]">
            {pendingCount} {t.workbench.pending}
          </span>
        </div>
      </div>

      {/* Grid Layouts by Category */}
      {Object.entries(itemsByCategory).map(([category, categoryItems]) => {
        if (categoryItems.length === 0) return null;
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider pl-1">
              {t.categories[category as Category]}
            </h3>
            <div className="content-grid">
              {categoryItems.map((item) => {
                const { hours, minutes, urgency } = getRemainingTime(item.expiresAt);
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    urgency={urgency}
                    remainingText={formatRemainingTime(hours, minutes)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {pendingCount === 0 && (
        <div className="flex flex-col items-center justify-center py-24 opacity-60">
          <div className="w-16 h-16 bg-[rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-center mb-4 text-[var(--color-ink-tertiary)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-[15px] font-medium text-[var(--color-ink-secondary)]">{t.workbench.allClear}</p>
        </div>
      )}

      {/* Mobile Floating Action Button */}
      <div className="md:hidden fixed bottom-20 right-6 z-40">
        <button
          onClick={() => {
            const textarea = document.querySelector('textarea');
            textarea?.focus();
            textarea?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-14 h-14 rounded-full bg-[var(--color-accent)] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </div>
  );
}
