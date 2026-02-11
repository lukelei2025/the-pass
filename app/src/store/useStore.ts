import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import localforage from 'localforage';
import type { Item, Settings, Category, ItemStatus } from '../types';

// 初始化 localForage
const itemsStore = localforage.createInstance({
  name: 'digital-workbench',
  storeName: 'items',
});

const settingsStore = localforage.createInstance({
  name: 'digital-workbench',
  storeName: 'settings',
});

// 默认设置
const defaultSettings: Settings = {
  expireHours: 24,
  clearanceTime: '22:00',
  theme: 'light',
  enableReminders: true,
  clearanceEnabled: true,
  llmApiKey: '',
  llmAutoClassify: true,
};

interface StoreState {
  items: Item[];
  settings: Settings;
  currentView: 'workbench' | 'menu' | 'freezer' | 'history' | 'settings';

  // Items 操作
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'expiresAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getItemsByStatus: (status: ItemStatus) => Item[];
  getItemsByCategory: (category: Category) => Item[];
  getPendingItems: () => Item[];
  getExpiredItems: () => Item[];

  // Settings 操作
  updateSettings: (updates: Partial<Settings>) => Promise<void>;

  // 视图切换
  setCurrentView: (view: 'workbench' | 'menu' | 'freezer' | 'history' | 'settings') => void;

  // 工具方法
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

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      settings: defaultSettings,
      currentView: 'workbench',

      // 添加卡片
      addItem: async (itemData) => {
        const newItem: Item = {
          ...itemData,
          id: generateId(),
          createdAt: Date.now(),
          expiresAt: calculateExpireTime(get().settings.expireHours),
        };

        // 保存到 localForage
        await itemsStore.setItem(newItem.id, newItem);

        set((state) => ({
          items: [...state.items, newItem],
        }));
      },

      // 更新卡片
      updateItem: async (id, updates) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;

        const updatedItem = { ...item, ...updates };
        await itemsStore.setItem(id, updatedItem);

        set((state) => ({
          items: state.items.map((i) => (i.id === id ? updatedItem : i)),
        }));
      },

      // 删除卡片
      deleteItem: async (id) => {
        await itemsStore.removeItem(id);
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
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
        await settingsStore.setItem('settings', newSettings);
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
            await get().updateItem(item.id, { status: 'expired' });
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

        // 如果当前时间已过清空时间
        if (now > clearanceTimeToday) {
          const pendingItems = items.filter((item) => item.status === 'pending');
          for (const item of pendingItems) {
            await get().updateItem(item.id, { status: 'expired' });
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

          // 导入所有卡片
          for (const item of data.items as Item[]) {
            await itemsStore.setItem(item.id, item);
          }

          // 导入设置（如果存在）
          if (data.settings) {
            await settingsStore.setItem('settings', data.settings);
            set({ settings: data.settings });
          }

          set({ items: data.items });
        } catch (error) {
          throw new Error('导入失败：数据格式不正确');
        }
      },
    }),
    {
      name: 'workbench-storage',
      // 不持久化 items（用 localForage 单独管理）
      partialize: (state) => ({
        settings: state.settings,
        currentView: state.currentView,
      }),
    }
  )
);
