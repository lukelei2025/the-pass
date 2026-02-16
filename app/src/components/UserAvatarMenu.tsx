import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store/useStore';

/**
 * UserAvatarMenu — 用户头像 + 弹出菜单 (Settings / Log out)
 * 
 * - Google 登录用户：显示 Google 头像
 * - Email 登录用户：显示邮箱首字母的圆形头像
 * - 点击头像弹出菜单 (渲染到 body 避免被 sidebar 裁剪)
 */
export default function UserAvatarMenu({ size = 'md' }: { size?: 'sm' | 'md' }) {
    const { user, signOut } = useAuth();
    const { t } = useTranslation();
    const { setCurrentView } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!user) return null;

    const avatarSize = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]';

    const getInitial = (): string => {
        if (user.displayName) return user.displayName.charAt(0).toUpperCase();
        if (user.email) return user.email.charAt(0).toUpperCase();
        return '?';
    };

    // 计算菜单位置 (基于按钮位置)
    const getMenuPosition = () => {
        if (!buttonRef.current) return {};
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 192; // w-48 = 12rem = 192px

        // 移动端 (宽 < 768px)：向下弹出
        if (window.innerWidth < 768) {
            // 如果左侧定位会导致溢出，则右对齐
            const left = rect.left + menuWidth > window.innerWidth
                ? window.innerWidth - menuWidth - 12 // 12px margin from edge
                : rect.left;

            return {
                position: 'fixed' as const,
                left: `${left}px`,
                top: `${rect.bottom + 8}px`, // 向下
            };
        }

        // 桌面端：向上弹出 (保持原有逻辑)
        return {
            position: 'fixed' as const,
            left: `${rect.left}px`,
            bottom: `${window.innerHeight - rect.top + 8}px`, // 向上
        };
    };

    return (
        <>
            {/* Avatar Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 transition-transform hover:scale-105"
            >
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt=""
                        className={`${avatarSize} rounded-full`}
                    />
                ) : (
                    <div className={`${avatarSize} rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white flex items-center justify-center font-semibold`}>
                        {getInitial()}
                    </div>
                )}
            </button>

            {/* Dropdown Menu — rendered via portal to avoid sidebar clipping */}
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="w-48 bg-white rounded-xl shadow-lg border border-[var(--color-border)] py-1 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                    style={getMenuPosition()}
                >
                    {/* User Info */}
                    <div className="px-3 py-2 border-b border-[var(--color-border)]">
                        <p className="text-[13px] font-medium text-[var(--color-ink)] truncate">
                            {user.displayName || user.email}
                        </p>
                        {user.displayName && user.email && (
                            <p className="text-[11px] text-[var(--color-ink-tertiary)] truncate">
                                {user.email}
                            </p>
                        )}
                    </div>

                    {/* Settings */}
                    <button
                        onClick={() => { setCurrentView('settings'); setIsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--color-ink)] transition-colors"
                    >
                        <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                        </svg>
                        {t.settings.title}
                    </button>

                    {/* Log Out */}
                    <button
                        onClick={() => { signOut(); setIsOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-red)] hover:bg-red-50 transition-colors"
                    >
                        <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {t.login.logout}
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}
