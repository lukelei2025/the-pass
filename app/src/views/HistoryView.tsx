import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mapCategory } from '../lib/constants';
import { useTranslation } from '../hooks/useTranslation';
import { useIsMobile } from '../hooks/useMediaQuery';
import SwipeableHistoryRow from '../components/SwipeableHistoryRow';

export default function HistoryView() {
  const { items, cleanupOldHistory, stats, loadStats, restoreItem } = useStore();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  useEffect(() => {
    cleanupOldHistory(48);
    loadStats();
  }, [cleanupOldHistory, loadStats]);

  const now = Date.now();
  const retentionMs = 48 * 60 * 60 * 1000;

  const processedItems = items.filter(item => {
    if (!['cooked', 'todo', 'frozen', 'composted', 'expired'].includes(item.status)) return false;
    const time = item.processedAt || item.createdAt;
    return (now - time) <= retentionMs;
  }).sort((a, b) => (b.processedAt || b.createdAt) - (a.processedAt || a.createdAt));

  const statusMap: Record<string, string> = {
    cooked: t.actions.clear,
    todo: t.actions.todo,
    frozen: t.actions.stash,
    composted: t.actions.void,
    expired: t.actions.expired,
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.history.title}</h2>
        <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
          {processedItems.length} {t.history.records}
        </span>
      </div>

      {/* Stats Grid - Uses persistent cumulative counters */}
      <div className="mb-12">
        {(() => {
          const { totalZaps, totalProcessed, totalTodos, completedTodos, totalStashed } = stats;
          const processRate = totalZaps > 0 ? Math.round((totalProcessed / totalZaps) * 100) : 0;
          const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

          const StatsCard = ({ label, value, colorClass }: { label: string, value: string | number, colorClass: string }) => (
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-[var(--color-ink-secondary)] mb-1">{label}</span>
              <span className={`text-[20px] font-semibold leading-none ${colorClass}`}>{value}</span>
            </div>
          );

          return (
            <div className="flex flex-wrap gap-y-8 gap-x-4 md:gap-x-12 items-center px-1">
              <div className="flex items-center gap-4 md:gap-8">
                <StatsCard label={t.history.stats.cumulativeZaps} value={totalZaps} colorClass="text-[#059669]" />
                <StatsCard label={t.history.stats.cumulativeProcessed} value={totalProcessed} colorClass="text-[#059669]" />
                <StatsCard label={t.history.stats.processRate} value={`${processRate}%`} colorClass="text-[#059669]" />
              </div>
              <div className="w-px h-8 bg-black/5 hidden lg:block" />
              <div className="flex items-center gap-4 md:gap-8">
                <StatsCard label={t.history.stats.cumulativeTodos} value={totalTodos} colorClass="text-[#2563EB]" />
                <StatsCard label={t.history.stats.completedTodos} value={completedTodos} colorClass="text-[#2563EB]" />
                <StatsCard label={t.history.stats.completionRate} value={`${completionRate}%`} colorClass="text-[#2563EB]" />
              </div>
              <div className="w-px h-8 bg-black/5 hidden xl:block" />
              <div className="flex items-center gap-4 md:gap-8">
                <StatsCard label={t.history.stats.stashed} value={totalStashed} colorClass="text-[#D97706]" />
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mb-1">
        <h3 className="text-[14px] font-medium text-[var(--color-ink)]">{t.history.recentRecords}</h3>
      </div>

      {
        processedItems.length === 0 ? (
          <div className="text-center py-24 text-[var(--color-ink-tertiary)] text-[14px]">
            {t.history.empty}
          </div>
        ) : (
          <div className="bg-white border border-[var(--color-border)] rounded-[10px] shadow-sm overflow-hidden text-[13px]">
            {isMobile ? (
              /* Stacked Layout for Mobile */
              <div className="divide-y divide-[var(--color-border)]">
                {processedItems.map((item) => {
                  const safeCategory = mapCategory(item.category);
                  const rowContent = (
                    <div className="p-3.5 space-y-1.5 hover:bg-[var(--color-surface-hover)] transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-wider">
                            {statusMap[item.status] || item.status}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-tertiary)] opacity-80">
                            {t.categories[safeCategory]}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-[var(--color-ink-tertiary)] font-mono">
                          {new Date(item.processedAt || item.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[14px] leading-snug text-[var(--color-ink)] line-clamp-2" title={item.content}>
                        {item.title || item.content}
                      </p>
                    </div>
                  );

                  return (
                    <SwipeableHistoryRow
                      key={item.id}
                      onRestore={() => restoreItem(item.id)}
                      restoreLabel={t.actions.restore}
                    >
                      {rowContent}
                    </SwipeableHistoryRow>
                  );
                })}
              </div>
            ) : (
              /* Standard Table for Desktop */
              <table className="w-full text-left">
                <thead className="bg-[var(--color-bg-app)] border-b border-[var(--color-border)] text-[var(--color-ink-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-normal w-24">{t.history.action}</th>
                    <th className="px-4 py-3 font-normal w-24">{t.history.category}</th>
                    <th className="px-4 py-3 font-normal">{t.history.content}</th>
                    <th className="px-4 py-3 font-normal w-32 text-right">{t.history.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {processedItems.map((item) => {
                    const safeCategory = mapCategory(item.category);
                    return (
                      <tr key={item.id} className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                        <td className="px-4 py-3 text-[var(--color-ink-secondary)] whitespace-nowrap">
                          {statusMap[item.status] || item.status}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
                            {t.categories[safeCategory]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-ink)] truncate max-w-sm" title={item.content}>
                          {item.title || item.content}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[var(--color-ink-tertiary)] font-mono">
                              {new Date(item.processedAt || item.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => restoreItem(item.id)}
                              title={t.actions.restore}
                              className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-md text-[11px] font-semibold text-[var(--color-green)] hover:bg-[rgba(5,150,105,0.1)]"
                            >
                              {t.actions.restore}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      }
    </div >
  );
}
