import { useState } from 'react';
import { useStore } from '../store/useStore';
import { testApiConnection } from '../lib/llm';

export default function SettingsView() {
    const { settings, updateSettings, setCurrentView } = useStore();
    const [apiKey, setApiKey] = useState(settings.llmApiKey);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    const handleSave = async () => {
        await updateSettings({ llmApiKey: apiKey });
        alert('Settings Saved');
    };

    const handleTestApi = async () => {
        if (!apiKey) return;
        setIsTesting(true);
        setTestResult(null);
        const result = await testApiConnection(apiKey);
        setTestResult(result);
        setIsTesting(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-4 pb-4 border-b border-[var(--color-border)]">
                <button
                    onClick={() => setCurrentView('workbench')}
                    className="md:hidden text-[var(--color-accent)] text-[15px] font-medium"
                >
                    &larr; Back
                </button>
                <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">Settings</h2>
            </div>

            <div className="space-y-6">
                {/* Section: AI */}
                <section>
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wide mb-3">AI Automation</h3>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[14px] font-medium text-[var(--color-ink)]">Auto-Classification</div>
                                <div className="text-[12px] text-[var(--color-ink-secondary)]">Intelligently categorize new items</div>
                            </div>
                            <button
                                onClick={() => updateSettings({ llmAutoClassify: !settings.llmAutoClassify })}
                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.llmAutoClassify ? 'bg-[var(--color-green)]' : 'bg-[#E9E9EA]'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.llmAutoClassify ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[13px] font-medium text-[var(--color-ink)]">GLM-4 API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="macos-input w-full p-2.5 font-mono text-[13px]"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={handleTestApi} className="text-[13px] font-medium text-[var(--color-accent)] hover:text-[#0077ED]">
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button onClick={handleSave} className="text-[13px] font-medium text-[var(--color-accent)] hover:text-[#0077ED]">
                                Save Key
                            </button>
                        </div>

                        {testResult && (
                            <p className={`text-[12px] font-medium ${testResult.success ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
                                {testResult.message}
                            </p>
                        )}
                    </div>
                </section>

                {/* Section: Expiry */}
                <section>
                    <h3 className="text-[13px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wide mb-3">Data Expiry</h3>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <span className="text-[14px] font-medium text-[var(--color-ink)]">Expire After</span>
                            <select
                                value={settings.expireHours}
                                onChange={(e) => updateSettings({ expireHours: Number(e.target.value) as 24 | 48 })}
                                className="bg-transparent text-[14px] text-[var(--color-ink-secondary)] outline-none cursor-pointer"
                            >
                                <option value={24}>24 Hours</option>
                                <option value={48}>48 Hours</option>
                            </select>
                        </div>

                        <div className="p-4 hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-[14px] font-medium text-[var(--color-ink)]">Daily Clearance</div>
                                    <div className="text-[12px] text-[var(--color-ink-secondary)]">Archive all pending items at a set time</div>
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
                                    <span className="text-[13px] text-[var(--color-ink-secondary)]">Clearance Time</span>
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
