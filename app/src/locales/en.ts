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
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        llm: 'LLM Configuration',
    },

    // Views
    workbench: {
        inputPlaceholder: 'Paste links, text, or ideas...',
        shortcuts: 'Cmd+Enter to send',
        groupByCategory: 'Group by Category',
        recent: 'Recent',
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
    },
};

export type Locale = typeof en;
