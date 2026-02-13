import type { Category } from '../types';

export const en = {
    // App
    appName: 'The Pass',

    // Sidebar
    nav: {
        zapIn: 'Zap-in',
        todo: 'To-do',
        stash: 'Stash',
        traces: 'Traces',
    },

    // Categories
    categories: {
        ideas: 'Ideas',
        work: 'Work',
        personal: 'Personal',
        external: 'External',
        others: 'Others',
    } as Record<Category, string>,

    // Actions
    actions: {
        clear: 'Clear',
        todo: 'To-do',
        stash: 'Stash',
        void: 'Void',
    },

    // Common
    common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        copy: 'Copy',
        edit: 'Edit',
        loading: 'Loading...',
    },

    // Settings
    settings: {
        title: 'Settings',
        language: 'Language',
        appLanguage: 'App Language',
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        llm: 'LLM Configuration',
        autoClassify: 'Auto-Classification',
        autoClassifyDesc: 'Intelligently categorize new items',
        apiKeyLabel: 'GLM-4 API Key',
        testConnection: 'Test Connection',
        saveKey: 'Save Key',
        dataExpiry: 'Data Expiry',
        expireAfter: 'Expire After',
        hours24: '24 Hours',
        hours48: '48 Hours',
        dailyClearance: 'Daily Clearance',
        dailyClearanceDesc: 'Archive all pending items at a set time',
        clearanceTime: 'Clearance Time',
        back: 'Back',
    },

    // Views
    workbench: {
        inputPlaceholder: 'Capture an idea or paste a link...',
        shortcuts: 'Cmd+Enter to send',
        groupByCategory: 'Group by Category',
        recent: 'Recent',
        classifying: 'Classifying...',
        autoClassifyOn: 'Auto-Classify On',
        autoClassifyOff: 'Auto-Classify Off',
        pending: 'Pending',
        allClear: 'All Clear',
    },
    menu: {
        title: 'To-do',
        empty: 'No tasks yet. Good job!',
    },
    freezer: {
        title: 'Stash',
        empty: 'Nothing in stash.',
    },
    history: {
        title: 'Traces',
        empty: 'No history yet.',
        clearHistory: 'Clear History',
        records: 'records',
    },
    item: {
        linkMetadata: 'Link metadata identified',
        copied: 'Copied to clipboard',
        copiedNotion: 'Copied Notion format',
        deleteConfirm: 'Are you sure you want to delete this item?',
        addNote: 'Add a note...',
        noNote: 'No note. Click to add...',
        copyNotion: 'Copy Notion',
        editNote: 'Edit Note',
    },

    // Category Selector
    categorySelect: {
        prompt: 'Select a category',
        cancel: 'Cancel',
        llmFailed: 'Auto-classification disabled, please select manually',
        offline: 'Offline mode, please select manually',
        changeCategory: 'Change category',
    },
};

export type Locale = typeof en;
