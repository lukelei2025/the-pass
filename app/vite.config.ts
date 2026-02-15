import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fetchTitlePlugin } from './vite-plugin-fetch-title'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    fetchTitlePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
      workbox: {
        // 强制立即激活新的 Service Worker
        skipWaiting: true,
        // 立即控制所有客户端
        clientsClaim: true,

        // ⚠️ 限制缓存范围，避免干扰 Firebase OAuth
        // 只缓存 API 请求，不缓存 Auth 重定向
        navigateFallbackDenylist: [
          /^\/__\/auth\//,          // Firebase Auth 重定向
          /^\/__\/firebase\//,        // Firebase internal
          /^\/__/,                   // Firebase internal
        ],

        // 禁用运行时缓存以避免干扰 OAuth 流程
        runtimeCaching: [
          {
            // 只缓存 API 路径，避免缓存 OAuth 相关请求
            urlPattern: /^https:\/\/the-pass-45baf\.web\.app\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'the-pass-cache',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],

        // ✅ 添加 Service Worker 导航配置
        navigateFallback: null,  // 禁用 fallback 导航
        navigationPreload: true,  // 启用预加载
      },
      manifest: {
        name: 'The Pass',
        short_name: 'The Pass',
        description: 'The Pass - Your Personal Information Workbench',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
