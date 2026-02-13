import { useState, useMemo, useCallback } from 'react';
import type { Category, Item } from '../types';

/**
 * 筛选状态接口
 */
export interface FilterState {
  searchQuery: string;
  selectedCategories: Set<Category>;
  selectedSources: Set<string>;
}

/**
 * 筛选选项接口
 */
export interface FilterOptions {
  availableCategories: Category[];
  availableSources: string[];
}

/**
 * 通用筛选 Hook
 * 用于处理搜索、分类筛选、平台标签筛选的统一逻辑
 *
 * @param items - 需要筛选的项目列表
 * @param filterFn - 自定义筛选函数（可选）
 * @returns 筛选状态和操作方法
 */
export function useFilters<T extends Item>(
  items: T[],
  filterFn?: (item: T, filters: FilterState) => boolean
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  // 动态提取所有出现过的分类
  const availableCategories = useMemo(() => {
    const cats = new Set<Category>();
    items.forEach(item => {
      if (item.category) cats.add(item.category as Category);
    });
    return Array.from(cats);
  }, [items]);

  // 动态提取所有出现过的平台标签
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    items.forEach(item => {
      if (item.source && !item.source.startsWith('http')) {
        sources.add(item.source);
      }
    });
    return Array.from(sources).sort();
  }, [items]);

  // 默认筛选逻辑
  const defaultFilter = useCallback((item: T, filters: FilterState) => {
    const { searchQuery: q, selectedCategories: cats, selectedSources: srcs } = filters;

    // 搜索逻辑
    if (q) {
      const query = q.toLowerCase();
      const matchContent = item.content.toLowerCase().includes(query);
      const matchSource = item.source?.toLowerCase().includes(query) || false;
      if (!matchContent && !matchSource) return false;
    }

    // 分类筛选
    if (cats.size > 0 && !cats.has(item.category as Category)) {
      return false;
    }

    // 平台标签筛选
    if (srcs.size > 0) {
      if (!item.source || !srcs.has(item.source)) return false;
    }

    return true;
  }, []);

  // 应用筛选
  const filteredItems = useMemo(() => {
    const filters: FilterState = {
      searchQuery,
      selectedCategories,
      selectedSources,
    };

    return items.filter(item => (filterFn || defaultFilter)(item, filters));
  }, [items, searchQuery, selectedCategories, selectedSources, filterFn, defaultFilter]);

  // 切换分类选中状态
  const toggleCategory = useCallback((cat: Category) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  // 切换平台标签选中状态
  const toggleSource = useCallback((source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  // 清除所有筛选
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories(new Set());
    setSelectedSources(new Set());
  }, []);

  // 检查是否有活动筛选
  const hasActiveFilters = !!(
    searchQuery ||
    selectedCategories.size > 0 ||
    selectedSources.size > 0
  );

  return {
    // 状态
    searchQuery,
    selectedCategories,
    selectedSources,
    filteredItems,
    availableCategories,
    availableSources,
    hasActiveFilters,

    // 操作方法
    setSearchQuery,
    toggleCategory,
    toggleSource,
    clearAllFilters,
  };
}
