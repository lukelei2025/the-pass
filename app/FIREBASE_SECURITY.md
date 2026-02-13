# Firebase Security Configuration

## API Key Security

### Current State
Your Firebase API Key is exposed in the client-side code. This is **normal and expected** for Firebase Web SDK.

The key in `.env.production`:
```
VITE_FIREBASE_API_KEY=AIzaSyBR71JJUu75cBnYOVbYO3d96Vs6hUrctfE
```

### What This Means
- ✅ This key **only works with your Firebase project**
- ✅ Cannot be used to access other Firebase projects
- ⚠️ Can be used to abuse your quota/costs
- ⚠️ Visible to anyone who inspects your website

### Security Best Practices

#### 1. **Enable Firebase Security Rules** 🔥

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow authenticated users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Current Rules Check:**
1. Go to: https://console.firebase.google.com/project/the-pass-45baf/firestore/rules
2. Ensure rules require authentication (`request.auth != null`)
3. Ensure users can only access their own data

#### 2. **Restrict API Key Usage** ⚙️

**GCP Console Steps:**
1. Visit: https://console.cloud.google.com/apis/credentials
2. Find your Firebase API Key
3. Under "Application restrictions", set:
   - **HTTP referrers**: `the-pass-45baf.web.app, the-pass-45baf.firebaseapp.com`
   - **IP addresses**: (optional) restrict to specific IPs

#### 3. **Monitor Usage** 📊

**Firebase Console:**
1. Visit: https://console.firebase.google.com/project/the-pass-45baf/usage
2. Check for abnormal activity
3. Set up budget alerts

#### 4. **Enable App Check** ✅

Prevent abuse by verifying that requests come from your app:

```typescript
import { initializeApp } from 'firebase/app';
import { getAppCheck } from 'firebase/app-check';

const app = initializeApp(firebaseConfig);
const appCheck = getAppCheck(app);

// Use reCAPTCHA v3 or custom providers
await appCheck.activate('YOUR_RECAPTCHA_SITE_KEY');
```

### Summary

| Aspect | Status | Recommendation |
|--------|---------|----------------|
| API Key exposed | ✅ Normal | Accept for Firebase Web SDK |
| Security Rules | ❓ Check | Verify authentication required |
| API restrictions | ⚠️ Open | Add referrer restrictions |
| App Check | ❓ Check | Consider enabling for production |

### Immediate Actions Required

1. ✅ Check Firestore rules require authentication
2. ✅ Add HTTP referrer restrictions to API key
3. ✅ Set up usage monitoring alerts
4. ⚠️ Consider rotating API key if compromised
