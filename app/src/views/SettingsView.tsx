import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';

export default function SettingsView() {
    const { settings, updateSettings, setCurrentView } = useStore();
    const { t, language, setLanguage } = useTranslation();

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-4 pb-4 border-b border-[var(--color-border)]">
                <button
                    onClick={() => setCurrentView('workbench')}
                    className="md:hidden text-[var(--color-accent)] text-[15px] font-medium"
                >
                    &larr; {t.settings.back}
                </button>
                <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.settings.title}</h2>
            </div>

            <div className="space-y-6">
                {/* Section: Language */}
                <section>
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wide mb-3">{t.settings.language}</h3>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <span className="text-[14px] font-medium text-[var(--color-ink)]">{t.settings.appLanguage}</span>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                                className="bg-transparent text-[14px] text-[var(--color-ink-secondary)] outline-none cursor-pointer"
                            >
                                <option value="en">English</option>
                                <option value="zh">中文 (Chinese)</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Section: AI */}
                <section>
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wide mb-3">{t.settings.llm}</h3>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[14px] font-medium text-[var(--color-ink)]">{t.settings.autoClassify}</div>
                                <div className="text-[12px] text-[var(--color-ink-secondary)]">{t.settings.autoClassifyDesc}</div>
                            </div>
                            <button
                                onClick={() => updateSettings({ llmAutoClassify: !settings.llmAutoClassify })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.llmAutoClassify ? 'bg-[var(--color-green)]' : 'bg-[#E9E9EA]'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.llmAutoClassify ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Section: Expiry */}
                <section>
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wide mb-3">{t.settings.dataExpiry}</h3>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <span className="text-[14px] font-medium text-[var(--color-ink)]">{t.settings.expireAfter}</span>
                            <select
                                value={settings.expireHours}
                                onChange={(e) => updateSettings({ expireHours: Number(e.target.value) as 24 | 48 })}
                                className="bg-transparent text-[14px] text-[var(--color-ink-secondary)] outline-none cursor-pointer"
                            >
                                <option value={24}>{t.settings.hours24}</option>
                                <option value={48}>{t.settings.hours48}</option>
                            </select>
                        </div>

                        <div className="p-4 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-[14px] font-medium text-[var(--color-ink)]">{t.settings.dailyClearance}</div>
                                    <div className="text-[12px] text-[var(--color-ink-secondary)]">{t.settings.dailyClearanceDesc}</div>
                                </div>
                                <button
                                    onClick={() => updateSettings({ clearanceEnabled: !settings.clearanceEnabled })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${settings.clearanceEnabled ? 'bg-[var(--color-green)]' : 'bg-[#E9E9EA]'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.clearanceEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {settings.clearanceEnabled && (
                                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                                    <span className="text-[13px] text-[var(--color-ink-secondary)]">{t.settings.clearanceTime}</span>
                                    <input
                                        type="time"
                                        value={settings.clearanceTime}
                                        onChange={(e) => updateSettings({ clearanceTime: e.target.value })}
                                        className="bg-transparent text-[14px] text-[var(--color-ink)] outline-none font-mono cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
