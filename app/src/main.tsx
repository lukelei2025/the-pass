import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getEnv } from './config/env'

// 验证环境变量
try {
  getEnv()
} catch (error) {
  console.error('应用初始化失败:', error)
  // 在开发环境中显示错误提示
  if (import.meta.env.DEV) {
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `
        <div style="padding: 20px; font-family: system-ui; max-width: 600px; margin: 100px auto;">
          <h1 style="color: #e53e3e;">⚠️ 应用初始化失败</h1>
          <p style="color: #718096;">缺少必需的环境变量配置</p>
          <p style="color: #718096;">请在项目根目录创建 .env 文件并配置以下变量：</p>
          <pre style="background: #f7fafc; padding: 16px; border-radius: 8px; overflow-x: auto;">VITE_FIREBASE_API_KEY=your_api_key_here</pre>
          <p style="color: #718096;">详细错误信息请查看浏览器控制台</p>
        </div>
      `
      throw error
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
