import { useStore } from '../store/useStore';
import { CATEGORY_INFO } from '../lib/constants';

export default function HistoryView() {
  const { items } = useStore();
  const processedItems = items.filter(item =>
    ['cooked', 'todo', 'frozen', 'composted', 'expired'].includes(item.status)
  ).sort((a, b) => (b.processedAt || b.createdAt) - (a.processedAt || a.createdAt));

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">Le Journal</h2>
        <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">{processedItems.length} records</span>
      </div>

      {processedItems.length === 0 ? (
        <div className="text-center py-24 text-[var(--color-ink-tertiary)] text-[14px]">
          No history
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)] rounded-[10px] shadow-sm overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--color-bg-app)] border-b border-[var(--color-border)] text-[var(--color-ink-secondary)] font-medium">
              <tr>
                <th className="px-4 py-3 font-medium w-32">Status</th>
                <th className="px-4 py-3 font-medium w-32">Category</th>
                <th className="px-4 py-3 font-medium">Content</th>
                <th className="px-4 py-3 font-medium w-32 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item) => {
                const statusMap: Record<string, string> = {
                  cooked: 'Fini',
                  todo: 'Tick',
                  frozen: 'Stow',
                  composted: 'Void',
                  expired: 'Expired',
                };
                return (
                  <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-secondary)]">
                      {statusMap[item.status] || item.status}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)]">
                        {CATEGORY_INFO[item.category].name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink)] truncate max-w-xs">{item.content}</td>
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
