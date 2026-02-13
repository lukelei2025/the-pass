# Firebase OAuth 登录修复指南

## 问题症状

控制台显示：
```
[Auth] Login cancelled by user
```

**这意味着：** `signInWithPopup` 被调用，但 Firebase OAuth 弹窗根本没有出现，立即被取消。

---

## 立即修复步骤

### 1. 检查授权域名 ⚠️ **最重要**

1. 打开 [Firebase Console - Authentication](https://console.firebase.google.com/project/the-pass-45baf/authentication/settings)
2. 向下滚动到 **"授权域名" (Authorized domains)**
3. **必须添加以下两个域名**：
   - `the-pass-45baf.web.app` ✅
   - `the-pass-45baf.firebaseapp.com` ✅

4. 点击 **"添加域名" (Add domain)** 添加

### 2. 检查登录方式

1. 在同一页面，找到 **"登录方法" (Sign-in method)**
2. 确保 **Google** 已启用 ✅
3. 如果没有，点击 **"添加登录方法" → 选择 Google**

---

## 验证修复

修复后，点击登录按钮应该：

1. **弹出小窗口** → Google OAuth 授权页面
2. 授权后自动关闭 → 返回应用
3. 控制台显示：
   ```
   [LoginPage-v2.0] Login button clicked
   [Auth] Standard mode, using popup sign-in
   [LoginPage-v2.0] signIn call completed  ✅
   ```

---

## 当前配置

你的 `firebase.ts` 当前配置：
```typescript
authDomain: "the-pass-45baf.web.app"
```

**注意：** 这个域名必须在 Firebase Console 的授权域名列表中！
