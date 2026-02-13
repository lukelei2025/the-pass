import type { Category, ContentType } from '../../types';

/**
 * 内容处理结果
 */
export interface ProcessedContent {
  title?: string;
  content: string;
  type: ContentType;
}

/**
 * 元数据接口
 */
export interface ContentMetadata {
  content: string;
  title?: string;
  source?: string;
  platform?: string;
  originalUrl?: string;
  isLink: boolean;
}

/**
 * 平台分享文案噪音模式
 * 用于识别和清理各大平台的默认分享文案
 */
const SHARE_NOISE_PATTERNS = [
  // 小红书
  /复制后打开.*$/s,
  /复制此链接.*$/s,
  /打开.*查看.*$/s,
  // 通用
  /分享自.*$/s,
  /来自.*$/s,
];

/**
 * 标签模式（hashtags）
 */
const HASHTAG_PATTERN = /#[^\s]+/g;

/**
 * URL 模式
 */
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/**
 * 从输入文本中提取 URL
 *
 * @param input - 用户输入的文本
 * @returns 提取到的 URL，如果没有则返回 null
 */
export function extractUrl(input: string): string | null {
  const match = input.match(URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * 清理平台分享文案噪音
 *
 * @param text - 原始文本
 * @returns 清理后的文本
 */
export function cleanShareNoise(text: string): string {
  let cleaned = text;

  // 移除平台噪音文案
  for (const pattern of SHARE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // 移除 hashtags
  cleaned = cleaned.replace(HASHTAG_PATTERN, '');

  return cleaned.trim();
}

/**
 * 文本标准化（用于去重检测）
 *
 * @param text - 原始文本
 * @returns 标准化后的文本（小写、去除标点和空白）
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[\s\p{P}]+/gu, ' ')
    .toLowerCase()
    .trim();
}

/**
 * 检测两个文本是否重复
 *
 * @param text1 - 文本 1
 * @param text2 - 文本 2
 * @returns 是否重复
 */
export function isDuplicateText(text1: string, text2: string): boolean {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  // 检查包含关系
  return (
    norm1.includes(norm2) ||
    norm2.includes(norm1) ||
    norm1 === norm2
  );
}

/**
 * 从链接输入中提取用户笔记
 *
 * @param inputText - 原始输入文本
 * @param linkTitle - 链接标题（如果有）
 * @returns 用户笔记内容
 */
export function extractUserNoteFromLink(
  inputText: string,
  linkTitle?: string
): string | null {
  // 去除 URL
  let userText = inputText
    .replace(URL_PATTERN, '')
    .trim();

  // 清理平台噪音
  userText = cleanShareNoise(userText);

  // 如果没有用户笔记
  if (!userText) {
    return null;
  }

  // 去重检测：如果笔记与标题重复，则丢弃笔记
  if (linkTitle && isDuplicateText(userText, linkTitle)) {
    return null;
  }

  return userText;
}

/**
 * 处理链接类型的内容
 * 分离标题和用户笔记
 *
 * @param inputText - 原始输入文本
 * @param metadata - LLM 返回的元数据
 * @returns 处理后的内容
 */
export function processLinkContent(
  inputText: string,
  metadata: ContentMetadata
): ProcessedContent {
  const title = metadata.title;
  const isXiaohongshu = metadata.platform === '小红书';
  const isDouyin = metadata.platform === '抖音';

  // 小红书和抖音特殊处理：激进清除分享文案
  // 这些平台的标题已经包含了完整信息，不需要额外的 content
  if (isXiaohongshu || isDouyin) {
    return {
      title,
      content: '',
      type: 'link',
    };
  }

  // 提取用户笔记
  const userNote = extractUserNoteFromLink(inputText, title);

  return {
    title,
    content: userNote || '',
    type: 'link',
  };
}

/**
 * 处理纯文本类型的内容
 *
 * @param inputText - 原始输入文本
 * @returns 处理后的内容
 */
export function processTextContent(inputText: string): ProcessedContent {
  return {
    title: undefined,
    content: inputText,
    type: 'text',
  };
}

/**
 * 主处理函数：根据输入类型处理内容
 *
 * @param inputText - 用户输入的原始文本
 * @param metadata - LLM 返回的元数据
 * @returns 处理后的内容对象
 */
export function processItemContent(
  inputText: string,
  metadata: ContentMetadata
): ProcessedContent {
  const isLink = metadata.isLink;

  if (isLink) {
    return processLinkContent(inputText, metadata);
  }

  return processTextContent(inputText);
}

/**
 * 验证和处理分类映射
 * 确保返回的分类是有效的
 *
 * @param category - LLM 返回的分类
 * @returns 有效的分类类型
 */
export function validateCategory(category: string): Category {
  const validCategories: Category[] = ['ideas', 'work', 'personal', 'external', 'others'];

  // 直接匹配
  if (validCategories.includes(category as Category)) {
    return category as Category;
  }

  // 旧数据映射
  const legacyMap: Record<string, Category> = {
    inspiration: 'ideas',
    idea: 'ideas',
    article: 'external',
    other: 'others',
  };

  return legacyMap[category.toLowerCase()] || 'others';
}
