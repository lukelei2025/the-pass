/**
 * 内容类型
 */
export type ContentType = 'text' | 'link' | 'note';

/**
 * 内容分类
 */
export type Category =
  | 'inspiration'  // 💡 随时灵感
  | 'work'         // 💼 工作待办
  | 'personal'     // 🏠 个人生活
  | 'article'      // 📰 文章链接
  | 'other';       // 📝 其他

/**
 * 卡片状态
 */
export type ItemStatus =
  | 'pending'    // 📋 待处理
  | 'cooked'     // 🔪 已处理
  | 'todo'       // 🥘 导出为任务
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
export type ViewType = 'workbench' | 'menu' | 'freezer' | 'history' | 'settings';

/**
 * 分类信息
 */
export interface CategoryInfo {
  id: Category;
  name: string;
  icon: string;
  color: string;
}
