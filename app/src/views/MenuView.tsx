import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getRemainingTime, formatRemainingTime } from '../lib/constants';
import ItemCard from '../components/ItemCard';
import { useTranslation } from '../hooks/useTranslation';
import { useFilters } from '../hooks/useFilters';
import SearchBar from '../components/ui/SearchBar';
import { CategoryFilterPills, SourceFilterPills, ClearFiltersButton } from '../components/ui/FilterPills';

export default function MenuView() {
  const { items } = useStore();
  const { t } = useTranslation();

  // 所有 todo 项目，按创建时间倒序
  const todoItems = useMemo(() =>
    items
      .filter(item => item.status === 'todo')
      .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  // 使用 useFilters Hook
  const {
    searchQuery,
    selectedCategories,
    selectedSources,
    filteredItems,
    availableCategories,
    availableSources,
    hasActiveFilters,
    setSearchQuery,
    toggleCategory,
    toggleSource,
    clearAllFilters,
  } = useFilters(todoItems);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.menu.title}</h2>
        <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
          {filteredItems.length}{hasActiveFilters ? ` / ${todoItems.length}` : ''} items
        </span>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search items to prep..."
      />

      {/* Filters */}
      {(availableCategories.length > 0 || availableSources.length > 0) && (
        <div className="space-y-2">
          <CategoryFilterPills
            categories={availableCategories}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            getCategoryLabel={(cat) => t.categories[cat]}
          />

          <SourceFilterPills
            sources={availableSources}
            selectedSources={selectedSources}
            onToggleSource={toggleSource}
          />

          {hasActiveFilters && (
            <ClearFiltersButton onClick={clearAllFilters}>
              Clear all filters
            </ClearFiltersButton>
          )}
        </div>
      )}

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="content-grid">
          {filteredItems.map(item => {
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
      ) : (
        <div className="flex flex-col items-center justify-center py-24 opacity-60">
          <div className="w-16 h-16 bg-[rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-center mb-4 text-[var(--color-ink-tertiary)]">
            {hasActiveFilters ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <p className="text-[15px] font-medium text-[var(--color-ink-secondary)]">
            {hasActiveFilters ? 'No matching items' : t.menu.empty}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
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
