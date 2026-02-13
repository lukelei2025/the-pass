import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { signIn } = useAuth();

    const handleSignIn = async () => {
        console.log('[LoginPage-v2.0] Login button clicked');
        console.log('[LoginPage-v2.0] Current time:', new Date().toISOString());
        console.log('[LoginPage-v2.0] signIn function:', typeof signIn);
        try {
            await signIn();
            console.log('[LoginPage-v2.0] signIn call completed');
        } catch (error) {
            console.error('[LoginPage-v2.0] Sign in error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg-app)] flex items-center justify-center p-6">
            <div className="w-full max-w-sm text-center space-y-8">
                {/* Logo / Title */}
                <div className="space-y-3">
                    <div className="text-5xl">🍳</div>
                    <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                        The Pass
                    </h1>
                    <p className="text-[14px] text-[var(--color-ink-secondary)] leading-relaxed">
                        Your digital workbench for capturing,<br />
                        classifying, and managing information flow.
                    </p>
                </div>

                {/* Sign In Button */}
                <button
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-[var(--color-border)] rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 group"
                >
                    {/* Version tag for debugging */}
                    <span className="absolute top-2 right-2 text-[8px] text-gray-400">v2.0</span>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="text-[15px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        使用 Google 登录
                    </span>
                </button>

                {/* Footer */}
                <p className="text-[11px] text-[var(--color-ink-tertiary)]">
                    登录后数据将自动云端同步
                </p>
            </div>
        </div>
    );
}
