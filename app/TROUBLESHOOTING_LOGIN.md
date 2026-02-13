# Firebase Google 登录问题诊断指南

## 问题症状
点击 Google 登录按钮后，打开新窗口显示相同页面，而不是 Google OAuth 授权页面。

## 可能原因和解决方案

### 1. Firebase 授权域未配置 ⚠️

**检查步骤：**
1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 选择项目 `the-pass-45baf`
3. 进入 **Authentication** → **Settings** → **Authorized domains**
4. 确认以下域名已添加：
   - `the-pass-45baf.web.app` ✅
   - `the-pass-45baf.firebaseapp.com` ✅

**如果没有添加，请点击 "Add domain" 添加这两个域名。**

---

### 2. PWA Standalone 模式限制 ⚠️

**问题：** PWA 的 `display: 'standalone'` 模式可能限制弹窗。

**临时测试：**
1. 在普通浏览器标签页中打开应用（不要使用已安装的 PWA）
2. 尝试登录
3. 如果普通标签页可以登录，说明是 PWA 问题

**永久修复：**
需要修改登录流程，在 PWA 模式下使用重定向而非弹窗：
```typescript
// 检测是否为 PWA standalone 模式
const isPWA = window.matchMedia('(display-mode: standalone)').matches;

if (isPWA) {
  // 使用 signInWithRedirect 而非 signInWithPopup
  await signInWithRedirect(auth, googleProvider);
} else {
  // 使用 signInWithPopup
  await signInWithPopup(auth, googleProvider);
}
```

---

### 3. Service Worker 拦截

**临时测试：**
1. 打开浏览器 DevTools (F12)
2. Application → Service Workers
3. 点击 "Unregister" 停用 Service Worker
4. 刷新页面并尝试登录

**如果 Service Worker 停用后可以登录：**
需要修改 `vite.config.ts` 中的 Service Worker 配置，排除 Firebase Auth 相关的 URL。

---

### 4. 浏览器弹窗阻止

**检查：**
1. 查看地址栏右侧是否有"弹窗被阻止"的图标
2. 如果有，点击允许该网站的弹窗

---

## 快速诊断命令

在浏览器控制台运行以下代码：

```javascript
// 检查 Firebase 配置
console.log(' authDomain:', import.meta.env.VITE_FIREBASE_API_KEY ? 'Configured' : 'Missing');

// 检查是否为 PWA 模式
console.log('PWA Mode:', window.matchMedia('(display-mode: standalone)').matches);

// 检查 Service Worker 状态
console.log('Service Worker:', navigator.serviceWorker.controller ? 'Active' : 'Inactive');
```

## 推荐测试顺序

1. ✅ 先在普通浏览器标签页测试（非 PWA）
2. ✅ 检查 Firebase Console 授权域配置
3. ✅ 临时停用 Service Worker 测试
4. ✅ 如果以上都正常，实现 PWA 模式检测代码
