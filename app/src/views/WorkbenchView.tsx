import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getRemainingTime, formatRemainingTime, mapCategory } from '../lib/constants';
import { classifyContent } from '../lib/llm';
import { processItemContent } from '../lib/processors/contentProcessor';
import type { Category, ContentType } from '../types';
import ItemCard from '../components/ItemCard';
import CategorySelector from '../components/ui/CategorySelector';
import { useTranslation } from '../hooks/useTranslation';

interface PendingItem {
  content: string;
  type: ContentType;
  source?: string;
  originalUrl?: string;
  title?: string;
}

export default function WorkbenchView() {
  const { items, addItem, settings } = useStore();
  const [inputText, setInputText] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [classificationReason, setClassificationReason] = useState<'offline' | 'disabled' | 'failed' | null>(null);
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

    const llmEnabled = settings.llmAutoClassify;

    // 1. 调用 LLM 分类并获取元数据
    const result = await classifyContent(inputText, {
      enabled: llmEnabled,
    });

    // 2. 处理内容（分离标题和用户笔记）
    const processed = processItemContent(inputText, result.metadata);

    // 3. 确定内容类型
    const type: ContentType = result.metadata.isLink ? 'link' : 'text';

    // 4. 检查是否需要手动分类
    if (!result.success) {
      // 保存待处理数据，显示分类选择器
      setPendingItem({
        content: processed.content,
        type,
        source: result.metadata.isLink ? (result.metadata.source || result.metadata.content) : undefined,
        originalUrl: result.metadata.isLink ? (result.metadata.originalUrl || result.metadata.content) : undefined,
        title: processed.title,
      });
      // 区分原因：离线 > 用户关闭 > AI失败
      if (result.offline) {
        setClassificationReason('offline');
      } else if (result.disabled) {
        setClassificationReason('disabled');
      } else {
        setClassificationReason('failed');
      }
      setShowCategorySelector(true);
      setIsClassifying(false);
      return;
    }

    // 5. 直接添加（分类成功）
    await addItem({
      content: processed.content,
      type,
      category: result.category,
      source: result.metadata.isLink ? (result.metadata.source || result.metadata.content) : undefined,
      originalUrl: result.metadata.isLink ? (result.metadata.originalUrl || result.metadata.content) : undefined,
      status: 'pending',
      title: processed.title,
    });

    setInputText('');
    setIsClassifying(false);
  };

  const handleCategorySelect = (category: Category) => {
    if (!pendingItem) return;

    console.log('[CategorySelect] 开始添加，分类:', category, '待处理数据:', pendingItem);

    // 不再等待 addItem 完成（状态会立即更新）
    addItem({
      ...pendingItem,
      category,
      status: 'pending',
    });

    console.log('[CategorySelect] addItem 调用完成，立即关闭窗口');

    // 立即关闭窗口
    setPendingItem(null);
    setShowCategorySelector(false);
    setIsClassifying(false);
    setInputText('');
  };

  const handleCategoryCancel = () => {
    setPendingItem(null);
    setShowCategorySelector(false);
    setClassificationReason(null);
    setIsClassifying(false);
  };

  const pendingCount = pendingItems.length;
  const llmConfigured = settings.llmAutoClassify;
  const isOffline = !navigator.onLine;

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
          <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${isOffline ? 'text-orange-500' : (llmConfigured ? 'text-[var(--color-green)]' : 'text-[var(--color-ink-tertiary)]')}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-orange-500' : (llmConfigured ? 'bg-[var(--color-green)]' : 'bg-[var(--color-ink-tertiary)]')}`} />
            {isClassifying ? t.workbench.classifying : (
              isOffline
                ? '离线模式'
                : (llmConfigured ? t.workbench.autoClassifyOn : t.workbench.autoClassifyOff)
            )}
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

      {/* Category Selector Modal */}
      {showCategorySelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-[17px] font-semibold text-[var(--color-ink)] mb-4">
              {classificationReason === 'offline'
                ? t.categorySelect.offline  // 离线模式
                : classificationReason === 'disabled'
                ? t.categorySelect.llmFailed  // 智能分类已关闭
                : t.categorySelect.llmFailed  // AI分类失败
              }
            </h2>
            <CategorySelector
              onSelect={handleCategorySelect}
              onCancel={handleCategoryCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
