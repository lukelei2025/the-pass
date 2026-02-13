import type { Locale } from './en';
import type { Category } from '../types';

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
        appLanguage: '应用语言',
        theme: '主题',
        light: '浅色',
        dark: '深色',
        llm: '大模型配置',
        autoClassify: '自动分类',
        autoClassifyDesc: '智能识别并归类新项目',
        apiKeyLabel: 'GLM-4 API Key',
        testConnection: '测试连接',
        saveKey: '保存 Key',
        dataExpiry: '数据过期',
        expireAfter: '过期时间',
        hours24: '24 小时',
        hours48: '48 小时',
        dailyClearance: '每日清理',
        dailyClearanceDesc: '在指定时间自动归档所有待处理项目',
        clearanceTime: '清理时间',
        back: '返回',
    },

    // Views
    // Views
    workbench: {
        inputPlaceholder: '捕捉灵感或粘贴链接...',
        shortcuts: 'Cmd+Enter 发送',
        groupByCategory: '按分类分组',
        recent: '最近',
        classifying: '分类中...',
        autoClassifyOn: '智能分类已开启',
        autoClassifyOff: '智能分类已关闭',
        pending: '待处理',
        allClear: '全部清空',
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
        records: '条记录',
    },
    item: {
        linkMetadata: '已识别链接元数据',
        copied: '已复制到剪贴板',
        copiedNotion: '已复制 Notion 格式',
        deleteConfirm: '确定要删除此项目吗？',
        addNote: '添加笔记...',
        noNote: '无笔记。点击添加...',
        copyNotion: '复制 Notion',
        editNote: '编辑笔记',
    },

    // Category Selector
    categorySelect: {
        prompt: '请选择分类',
        cancel: '取消',
        llmFailed: '智能分类已关闭，请手动选择',
        offline: '离线模式，请手动选择',
        changeCategory: '更改分类',
    },
};
