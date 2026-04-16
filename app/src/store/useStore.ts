import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import localforage from 'localforage';
import {
  type Item,
  type Settings,
  type Category,
  type ItemStatus,
  type ThoughtContainer,
  type ThoughtContainerDraft,
  type ThoughtEntry,
  type ThoughtEntryDraft,
  type UserStats,
} from '../types';
import * as firestoreService from '../lib/firestoreService';
import { buildThoughtEntryFromItem } from '../lib/thoughts';
import { getStatsDeltasForStatusChange } from '../lib/stats';

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
  thoughtContainers: ThoughtContainer[];
  thoughtEntries: ThoughtEntry[];
  settings: Settings;
  stats: UserStats;
  currentView: 'workbench' | 'menu' | 'freezer' | 'thoughts' | 'history' | 'settings';
  selectedThoughtContainerId: string | null;

  // Auth state
  userId: string | null;
  isOnline: boolean;
  migrationDone: boolean;
  isInitializingUser: boolean;
  initializingUserId: string | null;

  // Items 操作
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'expiresAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  getItemsByStatus: (status: ItemStatus) => Item[];
  getItemsByCategory: (category: Category) => Item[];
  getPendingItems: () => Item[];
  getExpiredItems: () => Item[];
  restoreItem: (id: string) => Promise<void>;

  // Settings 操作
  updateSettings: (updates: Partial<Settings>) => Promise<void>;

  // 视图切换
  setCurrentView: (view: 'workbench' | 'menu' | 'freezer' | 'thoughts' | 'history' | 'settings') => void;
  setSelectedThoughtContainerId: (containerId: string | null) => void;

  // Auth
  setUserId: (userId: string | null) => void;
  initializeForUser: (userId: string) => Promise<void>;
  clearUserSession: () => void;

  // Stats
  loadStats: () => Promise<void>;
  resetStats: (stats: UserStats) => Promise<void>;

  // 工具方法
  cleanupOldHistory: (retentionHours: number) => Promise<void>;
  checkExpired: () => Promise<void>;
  checkDailyClearance: () => Promise<void>;
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;

  // Thoughts
  createThoughtContainer: (draft: ThoughtContainerDraft) => Promise<string>;
  updateThoughtContainer: (id: string, updates: Partial<ThoughtContainer>) => Promise<void>;
  deleteThoughtContainer: (id: string) => Promise<void>;
  createThoughtEntry: (draft: ThoughtEntryDraft & { containerId: string; sourceItemId?: string | null }) => Promise<string>;
  updateThoughtEntry: (id: string, updates: Partial<ThoughtEntry>) => Promise<void>;
  deleteThoughtEntry: (id: string) => Promise<void>;
  moveItemToThought: (itemId: string, draft: ThoughtEntryDraft) => Promise<string>;
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
let unsubscribeThoughtContainers: (() => void) | null = null;
let unsubscribeThoughtEntries: (() => void) | null = null;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      thoughtContainers: [],
      thoughtEntries: [],
      settings: defaultSettings,
      stats: defaultUserStats,
      currentView: 'workbench',
      selectedThoughtContainerId: null,
      userId: null,
      isOnline: true,
      migrationDone: false,
      isInitializingUser: false,
      initializingUserId: null,

      // Set the logged-in user ID
      setUserId: (userId) => {
        set({ userId });
      },

      // Initialize store for a logged-in user
      initializeForUser: async (userId) => {
        const state = get();
        if (state.isInitializingUser && state.initializingUserId === userId) {
          return;
        }

        // 先写入 userId，避免初始化期间 addItem 错误走本地分支
        set({
          userId,
          isOnline: true,
          isInitializingUser: true,
          initializingUserId: userId,
        });

        // 注释：离线持久化已在 firebase.ts 中通过 persistentLocalCache 启用
        // 无需手动调用 enableOfflinePersistence

        try {
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

          if (unsubscribeThoughtContainers) {
            unsubscribeThoughtContainers();
          }

          unsubscribeThoughtContainers = firestoreService.subscribeToThoughtContainers(userId, (thoughtContainers) => {
            set({ thoughtContainers });
          });

          if (unsubscribeThoughtEntries) {
            unsubscribeThoughtEntries();
          }

          unsubscribeThoughtEntries = firestoreService.subscribeToThoughtEntries(userId, (thoughtEntries) => {
            set({ thoughtEntries });
          });
        } finally {
          set({
            isInitializingUser: false,
            initializingUserId: null,
          });
        }
      },

      clearUserSession: () => {
        if (unsubscribeItems) {
          unsubscribeItems();
          unsubscribeItems = null;
        }
        if (unsubscribeThoughtContainers) {
          unsubscribeThoughtContainers();
          unsubscribeThoughtContainers = null;
        }
        if (unsubscribeThoughtEntries) {
          unsubscribeThoughtEntries();
          unsubscribeThoughtEntries = null;
        }

        set({
          userId: null,
          items: [],
          thoughtContainers: [],
          thoughtEntries: [],
          stats: defaultUserStats,
          selectedThoughtContainerId: null,
          isInitializingUser: false,
          initializingUserId: null,
        });
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

      // Reset stats to specific values
      resetStats: async (newStats) => {
        const { userId } = get();
        if (!userId) return;
        await firestoreService.resetStats(userId, newStats);
        set({ stats: newStats });
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
            const newStatus = updates.status;
            const deltas = getStatsDeltasForStatusChange(oldItem.status, newStatus);

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
          ['cooked', 'thought', 'composted', 'expired'].includes(item.status)
        );

        if (historyItems.length === 0) return;

        if (userId) {
          await firestoreService.deleteItems(userId, historyItems.map(i => i.id));
        } else {
          for (const item of historyItems) {
            await itemsStore.removeItem(item.id);
          }
          set((state) => ({
            items: state.items.filter((i) => !['cooked', 'thought', 'composted', 'expired'].includes(i.status)),
          }));
        }
      },

      // 自动清理过期历史 (Auto cleanup > 48h)
      cleanupOldHistory: async (retentionHours: number) => {
        const { userId, items } = get();
        const now = Date.now();
        const retentionMs = retentionHours * 60 * 60 * 1000;

        // Filter items to DELETE:
        // 1. Status is in ['cooked', 'thought', 'composted', 'expired'] (preserve pending/todo/frozen)
        // 2. Time (processedAt or createdAt) is older than retention period
        const itemsToDelete = items.filter(item => {
          if (item.status === 'frozen' || item.status === 'pending' || item.status === 'todo') return false; // Preserve frozen, pending and todo

          if (['cooked', 'thought', 'composted', 'expired'].includes(item.status)) {
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

      // 恢复卡片到工作台（从记录页恢复）
      restoreItem: async (id) => {
        const { settings, userId } = get();
        await get().updateItem(id, {
          status: 'pending',
          processedAt: undefined,
          expiresAt: calculateExpireTime(settings.expireHours),
        });
        // Increment cumulative zap counter
        if (userId) {
          await firestoreService.incrementStats(userId, { totalZaps: 1 });
          set((state) => ({ stats: { ...state.stats, totalZaps: state.stats.totalZaps + 1 } }));
        }
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
        set((state) => ({
          currentView: view,
          selectedThoughtContainerId: view === 'thoughts' ? state.selectedThoughtContainerId : null,
        }));
      },

      setSelectedThoughtContainerId: (containerId) => {
        set({ selectedThoughtContainerId: containerId });
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
        } catch {
          throw new Error('导入失败：数据格式不正确');
        }
      },

      createThoughtContainer: async (draft) => {
        const { userId } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        const now = Date.now();
        const container: ThoughtContainer = {
          id: generateId(),
          title: draft.title.trim(),
          description: draft.description?.trim() || null,
          tags: draft.tags?.length ? draft.tags : null,
          createdAt: now,
          updatedAt: now,
        };

        await firestoreService.addThoughtContainer(userId, container);
        set({ selectedThoughtContainerId: container.id });
        return container.id;
      },

      updateThoughtContainer: async (id, updates) => {
        const { userId } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        await firestoreService.updateThoughtContainer(userId, id, {
          ...updates,
          updatedAt: Date.now(),
        });
      },

      deleteThoughtContainer: async (id) => {
        const { userId, selectedThoughtContainerId } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        await firestoreService.deleteThoughtEntriesByContainer(userId, id);
        await firestoreService.deleteThoughtContainer(userId, id);

        if (selectedThoughtContainerId === id) {
          set({ selectedThoughtContainerId: null });
        }
      },

      createThoughtEntry: async (draft) => {
        const { userId } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        const now = Date.now();
        const entry: ThoughtEntry = {
          id: generateId(),
          containerId: draft.containerId,
          title: draft.title.trim(),
          content: draft.content.trim(),
          tags: draft.tags,
          recordedAt: draft.recordedAt,
          sourceItemId: draft.sourceItemId || null,
          createdAt: now,
          updatedAt: now,
        };

        await firestoreService.addThoughtEntry(userId, entry);
        await firestoreService.updateThoughtContainer(userId, draft.containerId, {
          updatedAt: now,
        });
        set({ selectedThoughtContainerId: draft.containerId });
        return entry.id;
      },

      updateThoughtEntry: async (id, updates) => {
        const { userId, thoughtEntries } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        const oldEntry = thoughtEntries.find((entry) => entry.id === id);
        const nextContainerId = updates.containerId || oldEntry?.containerId;
        const now = Date.now();

        await firestoreService.updateThoughtEntry(userId, id, {
          ...updates,
          updatedAt: now,
        });

        if (oldEntry?.containerId) {
          await firestoreService.updateThoughtContainer(userId, oldEntry.containerId, {
            updatedAt: now,
          });
        }

        if (nextContainerId && nextContainerId !== oldEntry?.containerId) {
          await firestoreService.updateThoughtContainer(userId, nextContainerId, {
            updatedAt: now,
          });
        }
      },

      deleteThoughtEntry: async (id) => {
        const { userId, thoughtEntries } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        const entry = thoughtEntries.find((item) => item.id === id);
        await firestoreService.deleteThoughtEntry(userId, id);

        if (entry?.containerId) {
          await firestoreService.updateThoughtContainer(userId, entry.containerId, {
            updatedAt: Date.now(),
          });
        }
      },

      moveItemToThought: async (itemId, draft) => {
        const { userId, items, createThoughtContainer, createThoughtEntry, updateItem } = get();
        if (!userId) {
          throw new Error('User not initialized');
        }

        const item = items.find((entry) => entry.id === itemId);
        if (!item) {
          throw new Error('Item not found');
        }

        let containerId = draft.containerId || null;
        if (draft.createContainer || !containerId) {
          containerId = await createThoughtContainer({
            title: draft.containerTitle?.trim() || '未命名卡片',
            description: draft.containerDescription?.trim() || null,
            tags: draft.containerTags?.length ? draft.containerTags : null,
          });
        }

        const thoughtEntry = buildThoughtEntryFromItem(item, {
          ...draft,
          containerId,
        });

        await createThoughtEntry({
          containerId,
          title: thoughtEntry.title,
          content: thoughtEntry.content,
          tags: thoughtEntry.tags,
          recordedAt: thoughtEntry.recordedAt,
          sourceItemId: thoughtEntry.sourceItemId,
        });

        await updateItem(itemId, {
          status: 'thought',
          processedAt: Date.now(),
        });

        set({
          currentView: 'thoughts',
          selectedThoughtContainerId: containerId,
        });

        return containerId;
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
