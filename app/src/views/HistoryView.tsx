import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mapCategory } from '../lib/constants';
import { useTranslation } from '../hooks/useTranslation';

export default function HistoryView() {
  const { items, clearHistory, cleanupOldHistory } = useStore();
  const { t } = useTranslation();
  const [isClearing, setIsClearing] = useState(false);

  // Auto-cleanup on mount
  useEffect(() => {
    cleanupOldHistory(48);
  }, [cleanupOldHistory]);

  const now = Date.now();
  const retentionMs = 48 * 60 * 60 * 1000;

  const processedItems = items.filter(item => {
    // 1. Must be a history status
    if (!['cooked', 'todo', 'frozen', 'composted', 'expired'].includes(item.status)) return false;

    // 2. Must be within 48 hours
    const time = item.processedAt || item.createdAt;
    return (now - time) <= retentionMs;
  }).sort((a, b) => (b.processedAt || b.createdAt) - (a.processedAt || a.createdAt));

  const handleClearHistory = async () => {
    if (processedItems.length === 0) return;

    const confirmed = window.confirm(
      `确定要清空所有 ${processedItems.length} 条历史记录吗？此操作不可恢复。`
    );
    if (!confirmed) return;

    setIsClearing(true);
    try {
      await clearHistory();
    } catch (error) {
      console.error('清空历史记录失败:', error);
      alert('清空失败，请重试');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.history.title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
            {processedItems.length} {t.history.records}
          </span>
          {processedItems.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={isClearing}
              className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-red)] border border-[var(--color-red)] rounded-md hover:bg-[var(--color-red)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? '清空中...' : t.history.clearHistory}
            </button>
          )}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="mb-12">
        {(() => {
          // Calculate Stats
          const totalZaps = items.length;
          const processedCount = items.filter(i => i.status !== 'pending').length;
          const processRate = totalZaps > 0 ? Math.round((processedCount / totalZaps) * 100) : 0;

          // Todo stats: 
          // We assume 'todo' = Active, 'cooked' = Completed. 
          // Total Todos = Active + Completed.
          const activeTodos = items.filter(i => i.status === 'todo').length;
          const completedTodos = items.filter(i => i.status === 'cooked').length;
          const totalTodos = activeTodos + completedTodos;
          const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

          const stashedCount = items.filter(i => i.status === 'frozen').length;

          const StatsCard = ({ label, value, colorClass }: { label: string, value: string | number, colorClass: string }) => (
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-[var(--color-ink-secondary)] mb-1">{label}</span>
              <span className={`text-[20px] font-semibold leading-none ${colorClass}`}>{value}</span>
            </div>
          );

          return (
            <div className="flex flex-wrap gap-8 items-center px-1">
              {/* Group 1: Green */}
              <div className="flex items-center gap-8">
                <StatsCard label={t.history.stats.cumulativeZaps} value={totalZaps} colorClass="text-[#059669]" />
                <StatsCard label={t.history.stats.cumulativeProcessed} value={processedCount} colorClass="text-[#059669]" />
                <StatsCard label={t.history.stats.processRate} value={`${processRate}%`} colorClass="text-[#059669]" />
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-black/5 hidden md:block" />

              {/* Group 2: Blue */}
              <div className="flex items-center gap-8">
                <StatsCard label={t.history.stats.cumulativeTodos} value={totalTodos} colorClass="text-[#2563EB]" />
                <StatsCard label={t.history.stats.completedTodos} value={completedTodos} colorClass="text-[#2563EB]" />
                <StatsCard label={t.history.stats.completionRate} value={`${completionRate}%`} colorClass="text-[#2563EB]" />
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-black/5 hidden md:block" />

              {/* Group 3: Orange */}
              <div className="flex items-center gap-8">
                <StatsCard label={t.history.stats.stashed} value={stashedCount} colorClass="text-[#D97706]" />
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mb-1">
        <h3 className="text-[14px] font-medium text-[var(--color-ink)]">{t.history.recentRecords}</h3>
      </div>

      {processedItems.length === 0 ? (
        <div className="text-center py-24 text-[var(--color-ink-tertiary)] text-[14px]">
          {t.history.empty}
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)] rounded-[10px] shadow-sm overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--color-bg-app)] border-b border-[var(--color-border)] text-[var(--color-ink-secondary)] font-medium">
              <tr>
                <th className="px-4 py-3 font-medium w-32">{t.history.action}</th>
                <th className="px-4 py-3 font-medium w-32">{t.history.category}</th>
                <th className="px-4 py-3 font-medium">{t.history.content}</th>
                <th className="px-4 py-3 font-medium w-32 text-right">{t.history.date}</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item) => {
                const statusMap: Record<string, string> = {
                  cooked: t.actions.clear,
                  todo: t.actions.todo,
                  frozen: t.actions.stash,
                  composted: t.actions.void,
                  expired: 'Expired',
                };
                const safeCategory = mapCategory(item.category);
                return (
                  <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-secondary)]">
                      {statusMap[item.status] || item.status}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
                        {t.categories[safeCategory]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink)] truncate max-w-xs" title={item.content}>
                      {item.title || item.content}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-ink-tertiary)] font-mono">
                      {new Date(item.processedAt || item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
