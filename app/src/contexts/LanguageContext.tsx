import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '../locales/en';
import { zh } from '../locales/zh';

type Language = 'en' | 'zh';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: typeof en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        // Check localStorage first
        const saved = localStorage.getItem('app_language');
        if (saved === 'en' || saved === 'zh') return saved;
        // Fallback to browser language
        return navigator.language.startsWith('zh') ? 'zh' : 'en';
    });

    useEffect(() => {
        localStorage.setItem('app_language', language);
        // Update document title based on language
        document.title = language === 'zh' ? zh.appName : en.appName;
    }, [language]);

    const value = {
        language,
        setLanguage,
        t: language === 'zh' ? zh : en,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
