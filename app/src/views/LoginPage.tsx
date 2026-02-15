import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';

export default function LoginPage() {
    const { signIn, sendMagicLink } = useAuth();
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [magicLinkError, setMagicLinkError] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            await signIn();
        } catch (error) {
            console.error('[LoginPage] Google sign in error:', error);
        }
    };

    const handleSendMagicLink = async () => {
        if (!email.trim()) return;

        setIsSending(true);
        setMagicLinkError('');
        try {
            await sendMagicLink(email.trim());
            setMagicLinkSent(true);
        } catch (error) {
            console.error('[LoginPage] Magic link error:', error);
            setMagicLinkError(t.login.magicLinkError);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center p-6">
            <div className="w-full max-w-sm text-center space-y-8">
                {/* Logo / Title */}
                <div className="space-y-3">
                    <img src="/pwa-192x192.png" alt="The Pass" className="w-16 h-16 rounded-2xl mx-auto" />
                    <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                        The Pass
                    </h1>
                    <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                        {t.login.subtitle}
                    </p>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-3">
                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-[var(--color-border)] rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-[15px] font-medium text-gray-700">
                            {t.login.google}
                        </span>
                    </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-[12px] text-[var(--color-ink-tertiary)] font-medium uppercase tracking-wider">{t.login.or}</span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Email Magic Link */}
                {magicLinkSent ? (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                        </div>
                        <p className="text-[15px] font-medium text-[var(--color-ink)]">
                            {t.login.magicLinkSent}
                        </p>
                        <p className="text-[13px] text-[var(--color-ink-secondary)]">
                            {t.login.magicLinkSentDesc}
                        </p>
                        <button
                            onClick={() => { setMagicLinkSent(false); setEmail(''); }}
                            className="text-[13px] text-[var(--color-accent)] hover:underline"
                        >
                            {t.login.tryAnotherEmail}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMagicLink(); }}
                                placeholder={t.login.emailPlaceholder}
                                className="flex-1 px-4 py-3 bg-white border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-tertiary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                            />
                            <button
                                onClick={handleSendMagicLink}
                                disabled={isSending || !email.trim()}
                                className="px-4 py-3 bg-[var(--color-accent)] text-white text-[14px] font-medium rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {isSending ? '...' : t.login.sendLink}
                            </button>
                        </div>
                        {magicLinkError && (
                            <p className="text-[12px] text-[var(--color-red)]">{magicLinkError}</p>
                        )}
                        <p className="text-[11px] text-[var(--color-ink-tertiary)]">
                            {t.login.magicLinkDesc}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <p className="text-[11px] text-[var(--color-ink-tertiary)]">
                    {t.login.footer}
                </p>
            </div>
        </div>
    );
}
