import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';

/**
 * Firebase 配置
 *
 * 安全说明：
 * - VITE_FIREBASE_API_KEY 从 .env.local 或 .env.production 文件读取
 * - .env.local 和 .env.production 已在 .gitignore 中，不会被提交到仓库
 * - 启动时验证 API Key 存在性，防止意外泄露空配置
 * - 生产环境应通过 CI/CD 注入环境变量，不硬编码在源码中
 */

// 🔒 环境变量验证：防止空 API Key 导致的安全问题
const validateFirebaseConfig = () => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        throw new Error(
            '[Firebase Security] API Key is missing! ' +
            'Please set VITE_FIREBASE_API_KEY in .env.local or .env.production. ' +
            'This file should be in .gitignore to prevent accidental commits.'
        );
    }

    // 基本格式验证（Firebase API Key 通常以特定前缀开头）
    if (!apiKey.startsWith('AIza')) {
        console.warn('[Firebase Security] ⚠️ API Key format looks invalid (should start with "AIza")');
    }

    return apiKey;
};

const firebaseConfig = {
    apiKey: validateFirebaseConfig(),
    authDomain: "the-pass-45baf.web.app",
    projectId: "the-pass-45baf",
    storageBucket: "the-pass-45baf.firebasestorage.app",
    messagingSenderId: "68200182297",
    appId: "1:68200182297:web:a43555281d6d9f0896f088",
    measurementId: "G-E0299JP2VF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore with offline persistence using new API
// 使用 persistentLocalCache 替代已弃用的 enableIndexedDbPersistence
let db: Firestore;

try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({})
    });
    console.log('[Firebase] ✅ Firestore initialized with persistentLocalCache');
} catch (error) {
    console.error('[Firebase] ❌ Failed to initialize Firestore with persistentLocalCache:', error);
    console.warn('[Firebase] ⚠️ Falling back to default Firestore configuration');
    // 降级到默认配置
    db = initializeFirestore(app, {});
}

export { db };

export default app;
