import { Locale } from './en';
import { Category } from '../types';

export const zh: Locale = {
    // App
    appName: '乱入',

    // Sidebar
    nav: {
        zapIn: '乱入',
        todo: '待办',
        stash: '收藏',
        traces: '记录',
    },

    // Categories
    categories: {
        ideas: '灵感',
        work: '工作',
        personal: '个人',
        external: '外部链接',
        others: '其他',
    } as Record<Category, string>,

    // Actions
    actions: {
        clear: '完成',
        todo: '待办',
        stash: '收藏',
        void: '删除',
    },

    // Common
    common: {
        save: '保存',
        cancel: '取消',
        delete: '删除',
        copy: '复制',
        edit: '编辑',
        loading: '加载中...',
    },

    // Settings
    settings: {
        title: '设置',
        language: '语言',
        theme: '主题',
        light: '浅色',
        dark: '深色',
        llm: '大模型配置',
    },

    // Views
    workbench: {
        inputPlaceholder: '粘贴链接、文本或想法...',
        shortcuts: 'Cmd+Enter 发送',
        groupByCategory: '按分类分组',
        recent: '最近',
    },
    menu: {
        title: '待办清单',
        empty: '暂无待办事项。干得好！',
    },
    freezer: {
        title: '收藏夹',
        empty: '收藏夹是空的。',
    },
    history: {
        title: '历史记录',
        empty: '暂无历史记录。',
        clearHistory: '清空历史',
    },
};
