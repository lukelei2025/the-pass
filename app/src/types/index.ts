/**
 * 内容类型
 */
export type ContentType = 'text' | 'link' | 'note';

/**
 * 内容分类
 */
export type Category =
  | 'ideas'      // 💡 Ideas (was Inspiration)
  | 'work'       // 💼 Work
  | 'personal'   // 🏠 Personal
  | 'external'   // 🔗 External (was Article)
  | 'others';    // 📝 Others (was Other)

/**
 * 卡片状态
 */
export type ItemStatus =
  | 'pending'    // 📋 待处理
  | 'cooked'     // 🔪 已处理
  | 'todo'       // 🥘 导出为任务
  | 'thought'    // 🧠 导出为思绪
  | 'frozen'     // 🧊 导出为存储
  | 'composted'  // 🗑️ 已删除
  | 'expired';   // ⏰ 过期

/**
 * 时间紧迫度
 */
export type Urgency = 'normal' | 'warning' | 'alert' | 'urgent';

/**
 * 卡片数据模型
 */
export interface Item {
  id: string;
  content: string;
  type: ContentType;
  category: Category;
  source?: string;
  status: ItemStatus;
  createdAt: number;
  expiresAt: number;
  processedAt?: number;
  originalUrl?: string;
  title?: string;
  deadline?: number | null;
  details?: string | null;
  tags?: string[] | null;
}

export interface ThoughtContainer {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
  createdAt: number;
  updatedAt: number;
}

export interface ThoughtEntry {
  id: string;
  containerId: string;
  title: string;
  content: string;
  tags: string[];
  recordedAt: number;
  sourceItemId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ThoughtContainerDraft {
  title: string;
  description?: string | null;
  tags?: string[] | null;
}

export interface ThoughtEntryDraft {
  containerId?: string | null;
  createContainer?: boolean;
  containerTitle?: string;
  containerDescription?: string | null;
  containerTags?: string[] | null;
  title: string;
  content: string;
  tags: string[];
  recordedAt: number;
}

/**
 * 用户设置
 */
export interface Settings {
  expireHours: 24 | 48;
  clearanceTime: string; // 格式: "HH:mm"
  theme: 'light' | 'dark';
  enableReminders: boolean;
  clearanceEnabled: boolean;
  // LLM 配置 (llmApiKey 存在 localStorage, 不上传云端)
  llmAutoClassify: boolean;
}

/**
 * 导出数据格式
 */
export interface ExportData {
  version: string;
  exportDate: string;
  items: Item[];
  settings: Settings;
}

/**
 * 视图类型
 */
export type ViewType = 'workbench' | 'menu' | 'freezer' | 'thoughts' | 'history' | 'settings';

/**
 * 分类信息
 */
export interface CategoryInfo {
  id: Category;
  name: string;
  icon: string;
  color: string;
}

/**
 * 用户累计统计（持久化，不受清理影响）
 */
export interface UserStats {
  totalZaps: number;       // 累计乱入
  totalProcessed: number;  // 累计处理 (cooked + todo + frozen + composted)
  totalTodos: number;      // 累计待办
  completedTodos: number;  // 已完成待办
  totalStashed: number;    // 累计收藏
}
