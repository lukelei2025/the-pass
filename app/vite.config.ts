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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        // 强制立即激活新的 Service Worker
        skipWaiting: true,
        // 立即控制所有客户端
        clientsClaim: true,
        // 每次访问都检查更新（更频繁）
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/the-pass-45baf\.web\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'the-pass-cache',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
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
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
