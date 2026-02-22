import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import localforage from 'localforage';
import type { Item, Settings, Category, ItemStatus, UserStats } from '../types';
import * as firestoreService from '../lib/firestoreService';

// 初始化 localForage (kept for migration and offline fallback)
const itemsStore = localforage.createInstance({
  name: 'digital-workbench',
  storeName: 'items',
});

const settingsStore = localforage.createInstance({
  name: 'digital-workbench',
  storeName: 'settings',
});

// 默认设置 (不包含 llmApiKey, 它存在 localStorage)
const defaultSettings: Settings = {
  expireHours: 24,
  clearanceTime: '22:00',
  theme: 'light',
  enableReminders: true,
  clearanceEnabled: true,
  llmAutoClassify: true,
};

const defaultUserStats: UserStats = {
  totalZaps: 0,
  totalProcessed: 0,
  totalTodos: 0,
  completedTodos: 0,
  totalStashed: 0,
};

interface StoreState {
  items: Item[];
  settings: Settings;
  stats: UserStats;
  currentView: 'workbench' | 'menu' | 'freezer' | 'history' | 'settings';

  // Auth state
  userId: string | null;
  isOnline: boolean;
  migrationDone: boolean;

  // Items 操作
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'expiresAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  getItemsByStatus: (status: ItemStatus) => Item[];
  getItemsByCategory: (category: Category) => Item[];
  getPendingItems: () => Item[];
  getExpiredItems: () => Item[];

  // Settings 操作
  updateSettings: (updates: Partial<Settings>) => Promise<void>;

  // 视图切换
  setCurrentView: (view: 'workbench' | 'menu' | 'freezer' | 'history' | 'settings') => void;

  // Auth
  setUserId: (userId: string | null) => void;
  initializeForUser: (userId: string) => Promise<void>;

  // Stats
  loadStats: () => Promise<void>;

  // 工具方法
  cleanupOldHistory: (retentionHours: number) => Promise<void>;
  checkExpired: () => Promise<void>;
  checkDailyClearance: () => Promise<void>;
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 计算过期时间
function calculateExpireTime(hours: 24 | 48): number {
  return Date.now() + hours * 60 * 60 * 1000;
}

// Firestore unsubscribe tracker
let unsubscribeItems: (() => void) | null = null;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      settings: defaultSettings,
      stats: defaultUserStats,
      currentView: 'workbench',
      userId: null,
      isOnline: true,
      migrationDone: false,

      // Set the logged-in user ID
      setUserId: (userId) => {
        set({ userId });
      },

      // Initialize store for a logged-in user
      initializeForUser: async (userId) => {
        // 注释：离线持久化已在 firebase.ts 中通过 persistentLocalCache 启用
        // 无需手动调用 enableOfflinePersistence

        if (!get().migrationDone) {
          try {
            // Read all local items
            const localItems: Item[] = [];
            await itemsStore.iterate<Item, void>((value) => {
              localItems.push(value);
            });

            // Read local settings
            const localSettings = await settingsStore.getItem<Settings>('settings');

            await firestoreService.migrateLocalData(
              userId,
              localItems,
              localSettings || defaultSettings
            );

            set({ migrationDone: true });
          } catch (error) {
            console.error('Migration error:', error);
          }
        }

        // 2. Load settings from Firestore
        try {
          const cloudSettings = await firestoreService.getSettings(userId);
          if (cloudSettings) {
            set({ settings: cloudSettings });
          }
        } catch (error) {
          console.error('Failed to load cloud settings:', error);
        }

        // 3. Load stats from Firestore
        try {
          const cloudStats = await firestoreService.getStats(userId);
          set({ stats: cloudStats });
        } catch (error) {
          console.error('Failed to load cloud stats:', error);
        }

        // 4. Subscribe to real-time items
        if (unsubscribeItems) {
          unsubscribeItems();
        }

        unsubscribeItems = firestoreService.subscribeToItems(userId, (items) => {
          set({ items });
        });

        set({ userId, isOnline: true });
      },

      // Load stats from Firestore (for refreshing in HistoryView)
      loadStats: async () => {
        const { userId } = get();
        if (!userId) return;
        try {
          const cloudStats = await firestoreService.getStats(userId);
          set({ stats: cloudStats });
        } catch (error) {
          console.error('Failed to load stats:', error);
        }
      },

      // 添加卡片
      addItem: async (itemData) => {
        const newItem: Item = {
          ...itemData,
          id: generateId(),
          createdAt: Date.now(),
          expiresAt: calculateExpireTime(get().settings.expireHours),
        };

        const { userId } = get();

        if (userId) {
          // Online: write to Firestore (real-time subscription will update state)
          await firestoreService.addItem(userId, newItem);
          // Increment cumulative zap counter
          await firestoreService.incrementStats(userId, { totalZaps: 1 });
          set((state) => ({ stats: { ...state.stats, totalZaps: state.stats.totalZaps + 1 } }));
        } else {
          // Offline fallback: write to localForage
          await itemsStore.setItem(newItem.id, newItem);
          set((state) => ({
            items: [...state.items, newItem],
          }));
        }
      },

      // 更新卡片
      updateItem: async (id, updates) => {
        const { userId } = get();
        const oldItem = get().items.find((i) => i.id === id);

        if (userId) {
          await firestoreService.updateItem(userId, id, updates);

          // Track status changes for cumulative stats
          if (updates.status && oldItem && oldItem.status !== updates.status) {
            const deltas: Partial<Record<keyof UserStats, number>> = {};
            const newStatus = updates.status;

            // Count as processed when moving out of pending
            if (oldItem.status === 'pending' && newStatus !== 'pending') {
              deltas.totalProcessed = 1;
            }
            // Track specific destination statuses
            if (newStatus === 'todo') deltas.totalTodos = 1;
            if (newStatus === 'frozen') deltas.totalStashed = 1;
            if (newStatus === 'cooked' && oldItem.status === 'todo') deltas.completedTodos = 1;

            if (Object.keys(deltas).length > 0) {
              await firestoreService.incrementStats(userId, deltas);
              // Update local state optimistically
              set((state) => {
                const newStats = { ...state.stats };
                for (const [key, value] of Object.entries(deltas)) {
                  newStats[key as keyof UserStats] += value!;
                }
                return { stats: newStats };
              });
            }
          }
        } else {
          if (!oldItem) return;
          const updatedItem = { ...oldItem, ...updates };
          await itemsStore.setItem(id, updatedItem);
          set((state) => ({
            items: state.items.map((i) => (i.id === id ? updatedItem : i)),
          }));
        }
      },

      // 删除卡片
      deleteItem: async (id) => {
        const { userId } = get();

        if (userId) {
          await firestoreService.deleteItem(userId, id);
        } else {
          await itemsStore.removeItem(id);
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
          }));
        }
      },

      // 清空历史记录 (只清除已处理/已过期，不动工作台/待办/收藏)
      clearHistory: async () => {
        const { userId, items } = get();
        const historyItems = items.filter(item =>
          ['cooked', 'composted', 'expired'].includes(item.status)
        );

        if (historyItems.length === 0) return;

        if (userId) {
          await firestoreService.deleteItems(userId, historyItems.map(i => i.id));
        } else {
          for (const item of historyItems) {
            await itemsStore.removeItem(item.id);
          }
          set((state) => ({
            items: state.items.filter((i) => !['cooked', 'composted', 'expired'].includes(i.status)),
          }));
        }
      },

      // 自动清理过期历史 (Auto cleanup > 48h)
      cleanupOldHistory: async (retentionHours: number) => {
        const { userId, items } = get();
        const now = Date.now();
        const retentionMs = retentionHours * 60 * 60 * 1000;

        // Filter items to DELETE:
        // 1. Status is in ['cooked', 'todo', 'composted', 'expired'] (NOT 'frozen')
        // 2. Time (processedAt or createdAt) is older than retention period
        const itemsToDelete = items.filter(item => {
          if (item.status === 'frozen' || item.status === 'pending') return false; // Preserve frozen and pending

          if (['cooked', 'todo', 'composted', 'expired'].includes(item.status)) {
            const time = item.processedAt || item.createdAt;
            return (now - time) > retentionMs;
          }
          return false;
        });

        if (itemsToDelete.length === 0) return;

        console.log(`Auto-cleaning ${itemsToDelete.length} old history items...`);

        if (userId) {
          await firestoreService.deleteItems(userId, itemsToDelete.map(i => i.id));
        } else {
          for (const item of itemsToDelete) {
            await itemsStore.removeItem(item.id);
          }
          const deletedIds = new Set(itemsToDelete.map(i => i.id));
          set((state) => ({
            items: state.items.filter((i) => !deletedIds.has(i.id)),
          }));
        }
      },

      // 按状态获取卡片
      getItemsByStatus: (status) => {
        return get().items.filter((item) => item.status === status);
      },

      // 按分类获取卡片
      getItemsByCategory: (category) => {
        return get().items.filter((item) => item.category === category);
      },

      // 获取待处理卡片
      getPendingItems: () => {
        return get().items.filter((item) => item.status === 'pending');
      },

      // 获取已过期卡片
      getExpiredItems: () => {
        const now = Date.now();
        return get().items.filter(
          (item) => item.status === 'pending' && item.expiresAt < now
        );
      },

      // 更新设置
      updateSettings: async (updates) => {
        const newSettings = { ...get().settings, ...updates };
        const { userId } = get();

        if (userId) {
          await firestoreService.updateSettings(userId, newSettings);
        } else {
          await settingsStore.setItem('settings', newSettings);
        }

        set({ settings: newSettings });
      },

      // 切换视图
      setCurrentView: (view) => {
        set({ currentView: view });
      },

      // 检查过期卡片
      checkExpired: async () => {
        const now = Date.now();
        const pendingItems = get().items.filter((item) => item.status === 'pending');

        for (const item of pendingItems) {
          if (item.expiresAt < now) {
            await get().updateItem(item.id, { status: 'expired', processedAt: now });
          }
        }
      },

      // 检查每日清空
      checkDailyClearance: async () => {
        const { settings, items } = get();
        if (!settings.clearanceEnabled) return;

        const now = new Date();
        const [hour, minute] = settings.clearanceTime.split(':').map(Number);
        const clearanceTimeToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          minute,
          0,
          0
        );

        if (now > clearanceTimeToday) {
          const pendingItems = items.filter((item) => item.status === 'pending');
          const clearTime = Date.now();
          for (const item of pendingItems) {
            await get().updateItem(item.id, { status: 'expired', processedAt: clearTime });
          }
        }
      },

      // 导出数据
      exportData: async () => {
        const { items, settings } = get();
        const exportData = {
          version: '1.0',
          exportDate: new Date().toISOString(),
          items,
          settings,
        };
        return JSON.stringify(exportData, null, 2);
      },

      // 导入数据
      importData: async (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid data format');
          }

          const { userId } = get();

          if (userId) {
            // Import to Firestore
            for (const item of data.items as Item[]) {
              await firestoreService.addItem(userId, item);
            }
            if (data.settings) {
              await firestoreService.updateSettings(userId, data.settings);
              set({ settings: data.settings });
            }
          } else {
            // Import to localForage
            for (const item of data.items as Item[]) {
              await itemsStore.setItem(item.id, item);
            }
            if (data.settings) {
              await settingsStore.setItem('settings', data.settings);
              set({ settings: data.settings });
            }
            set({ items: data.items });
          }
        } catch (error) {
          throw new Error('导入失败：数据格式不正确');
        }
      },
    }),
    {
      name: 'workbench-storage',
      // Only persist view and migration state locally
      partialize: (state) => ({
        currentView: state.currentView,
        migrationDone: state.migrationDone,
      }),
    }
  )
);
