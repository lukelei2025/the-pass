import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { CATEGORY_INFO } from '../lib/constants';
import type { Category } from '../types';
import ListItem from '../components/ListItem';

export default function FreezerView() {
  const { items } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  // 1. 获取所有 frozen 项目，按创建时间倒序
  const frozenItems = useMemo(() =>
    items
      .filter(item => item.status === 'frozen')
      .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  // 2. 动态提取所有出现过的平台标签 (用于筛选)
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    frozenItems.forEach(item => {
      if (item.source && !item.source.startsWith('http')) {
        sources.add(item.source);
      }
    });
    return Array.from(sources).sort();
  }, [frozenItems]);

  // 3. 动态提取所有出现过的分类
  const availableCategories = useMemo(() => {
    const cats = new Set<Category>();
    frozenItems.forEach(item => cats.add(item.category));
    return Array.from(cats);
  }, [frozenItems]);

  // 4. 搜索 + 多维筛选
  const filteredItems = useMemo(() => {
    return frozenItems.filter(item => {
      // 搜索逻辑
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchContent = item.content.toLowerCase().includes(q);
        const matchSource = item.source?.toLowerCase().includes(q) || false;
        if (!matchContent && !matchSource) return false;
      }
      // 分类筛选
      if (selectedCategories.size > 0 && !selectedCategories.has(item.category)) {
        return false;
      }
      // 平台标签筛选
      if (selectedSources.size > 0) {
        if (!item.source || !selectedSources.has(item.source)) return false;
      }
      return true;
    });
  }, [frozenItems, searchQuery, selectedCategories, selectedSources]);

  const toggleCategory = (cat: Category) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const hasActiveFilters = searchQuery || selectedCategories.size > 0 || selectedSources.size > 0;

  // 分类 pill 的颜色映射
  const categoryPillStyle = (cat: Category, selected: boolean) => {
    if (!selected) {
      return 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.08)]';
    }
    const styles: Record<Category, string> = {
      inspiration: 'bg-[var(--bg-tag-orange)] text-[var(--color-orange)] ring-1 ring-[var(--color-orange)]/30',
      work: 'bg-[var(--bg-tag-blue)] text-[var(--color-blue)] ring-1 ring-[var(--color-blue)]/30',
      personal: 'bg-[var(--bg-tag-green)] text-[var(--color-green)] ring-1 ring-[var(--color-green)]/30',
      article: 'bg-[var(--bg-tag-purple)] text-[var(--color-purple)] ring-1 ring-[var(--color-purple)]/30',
      other: 'bg-[var(--bg-tag-gray)] text-[var(--color-gray)] ring-1 ring-[var(--color-gray)]/30',
    };
    return styles[cat];
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">La Réserve</h2>
        <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
          {filteredItems.length}{hasActiveFilters ? ` / ${frozenItems.length}` : ''} items
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-tertiary)]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stowed items..."
          className="macos-input w-full pl-10 pr-4 py-2.5 text-[14px]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters (Combined Categories & Sources) */}
      {(availableCategories.length > 0 || availableSources.length > 0) && (
        <div className="space-y-2">
          {/* Category Pills */}
          {availableCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer ${categoryPillStyle(cat, selectedCategories.has(cat))}`}
                >
                  {CATEGORY_INFO[cat].name}
                </button>
              ))}
            </div>
          )}

          {/* Source/Platform Pills */}
          {availableSources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableSources.map(source => (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-150 cursor-pointer ${selectedSources.has(source)
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.08)]'
                    }`}
                >
                  {source}
                </button>
              ))}
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategories(new Set());
                setSelectedSources(new Set());
              }}
              className="text-[12px] text-[var(--color-accent)] hover:text-[#0077ED] font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Unified List View (No Grouping) */}
      {filteredItems.length > 0 ? (
        <div className="border border-[var(--color-border)] rounded-[10px] overflow-hidden bg-white shadow-sm">
          {filteredItems.map(item => (
            <ListItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-24 opacity-60">
          <div className="w-16 h-16 bg-[rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-center mb-4 text-[var(--color-ink-tertiary)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[var(--color-ink-secondary)]">
            {hasActiveFilters ? 'No matching items' : 'Réserve empty'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategories(new Set());
                setSelectedSources(new Set());
              }}
              className="mt-2 text-[13px] text-[var(--color-accent)] hover:text-[#0077ED] font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
