import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';
import {
    auth,
    googleProvider,
    authPersistenceReady,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from '../lib/firebase';

/**
 * 检测是否运行在 PWA standalone 模式
 * PWA 模式下弹窗可能被阻止，需要使用重定向登录
 */
function isPWAMode(): boolean {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    console.log('[Auth] Check PWA Mode:', { isStandalone, isIOSStandalone });
    return isStandalone || isIOSStandalone;
}

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    sendMagicLink: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 等待持久化设置完成后再监听 Auth 状态
        // 这确保 Auth 从 IndexedDB 恢复了之前的登录状态
        authPersistenceReady.then(() => {
            // 检查重定向登录的结果 (处理 signInWithRedirect 返回的情况)
            getRedirectResult(auth).then((result) => {
                if (result) {
                    console.log('[Auth] Redirect login success:', result.user.uid);
                }
            }).catch((error) => {
                console.error('[Auth] Redirect login error:', error);
            });

            // 检查是否从 Magic Link 回调
            if (isSignInWithEmailLink(auth, window.location.href)) {
                let email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
                if (!email) {
                    // 如果在不同设备/浏览器打开链接，需要用户重新输入邮箱
                    email = window.prompt('请输入你的邮箱地址以完成登录：');
                }
                if (email) {
                    signInWithEmailLink(auth, email, window.location.href)
                        .then((result) => {
                            console.log('[Auth] Magic link sign-in success:', result.user.uid);
                            window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
                            // 清除 URL 中的签名参数
                            window.history.replaceState(null, '', window.location.pathname);
                        })
                        .catch((error) => {
                            console.error('[Auth] Magic link sign-in error:', error);
                        });
                }
            }
        });

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('[Auth] Auth state changed:', user ? 'Logged In' : 'Logged Out');
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => {
        try {
            // 持久化已在 firebase.ts 初始化时设置，无需重复设置
            console.log('[Auth] Attempting Google sign in...');
            if (isPWAMode()) {
                console.log('[Auth] PWA mode detected, using redirect sign-in');
                await signInWithRedirect(auth, googleProvider);
            } else {
                console.log('[Auth] Standard mode, using popup sign-in');
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'auth/cancelled-popup-request') {
                console.log('[Auth] Login cancelled by user');
                return;
            }
            console.error('Login failed:', error);
            throw error;
        }
    };

    const sendMagicLink = async (email: string) => {
        const actionCodeSettings = {
            url: window.location.origin + '/login',
            handleCodeInApp: true,
        };

        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        // 保存邮箱以便回调时自动填充
        window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
        console.log('[Auth] Magic link sent to:', email);
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut, sendMagicLink }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
