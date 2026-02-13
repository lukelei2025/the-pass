import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

/**
 * 检测是否运行在 PWA standalone 模式
 * PWA 模式下弹窗可能被阻止，需要使用重定向登录
 */
function isPWAMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           // @ts-expect-no - iOS Safari specific property
           (window.navigator as { standalone?: boolean }).standalone === true;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => {
        try {
            // PWA 模式下使用重定向登录，避免弹窗被阻止
            if (isPWAMode()) {
                console.log('[Auth] PWA mode detected, using redirect sign-in');
                await signInWithRedirect(auth, googleProvider);
            } else {
                console.log('[Auth] Standard mode, using popup sign-in');
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            // auth/cancelled-popup-request 表示用户取消了登录，不是真正的错误
            if (error instanceof Error && 'code' in error && error.code === 'auth/cancelled-popup-request') {
                console.log('[Auth] Login cancelled by user');
                return;
            }
            console.error('Login failed:', error);
            throw error;
        }
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
        <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
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
