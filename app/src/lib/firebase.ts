import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: "the-pass-45baf.firebaseapp.com",
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
