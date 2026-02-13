import { useState, useEffect } from 'react';

/**
 * 预定义的断点
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * 媒体查询 Hook
 * 用于响应式检测
 *
 * @param query - 媒体查询字符串（如 '(max-width: 768px)'）
 * @returns 是否匹配查询
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDark = useMediaQuery('(prefers-color-scheme: dark)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // 设置初始值
    setMatches(mediaQuery.matches);

    // 监听变化
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 使用现代 API
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * 预定义的响应式检测 Hooks
 */

/**
 * 检测是否为移动端（< 768px）
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/**
 * 检测是否为平板（768px - 1023px）
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * 检测是否为桌面端（>= 768px）
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/**
 * 检测是否为深色模式偏好
 */
export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * 检测是否支持悬停（非触摸设备）
 */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover)');
}

/**
 * 检测是否为触摸设备
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}
