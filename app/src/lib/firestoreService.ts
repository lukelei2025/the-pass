import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    writeBatch,
    getDoc,
    updateDoc,
    increment
} from 'firebase/firestore';
import { db } from './firebase';
import type { Item, Settings, UserStats } from '../types';

// ==========================================
// Items CRUD
// ==========================================

/**
 * Firestore does not accept `undefined` values.
 * Strip them before writing.
 */
function stripUndefined<T extends object>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as T;
}

const getUserItemsCollection = (userId: string) =>
    collection(db, 'users', userId, 'items');

const getUserItemDoc = (userId: string, itemId: string) =>
    doc(db, 'users', userId, 'items', itemId);

export async function addItem(userId: string, item: Item): Promise<void> {
    await setDoc(getUserItemDoc(userId, item.id), stripUndefined(item));
}

export async function updateItem(userId: string, itemId: string, updates: Partial<Item>): Promise<void> {
    await setDoc(getUserItemDoc(userId, itemId), stripUndefined(updates), { merge: true });
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
    await deleteDoc(getUserItemDoc(userId, itemId));
}

/**
 * Delete multiple items in batches.
 * Firestore allows max 500 operations per batch.
 */
export async function deleteItems(
    userId: string,
    itemIds: string[]
): Promise<void> {
    const batchSize = 450;
    for (let i = 0; i < itemIds.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = itemIds.slice(i, i + batchSize);

        for (const itemId of chunk) {
            const docRef = getUserItemDoc(userId, itemId);
            batch.delete(docRef);
        }

        await batch.commit();
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(itemIds.length / batchSize)}`);
    }
}

/**
 * Subscribe to real-time item updates.
 * Returns an unsubscribe function.
 */
export function subscribeToItems(
    userId: string,
    callback: (items: Item[]) => void
): () => void {
    // No orderBy to avoid requiring a Firestore index; sort in memory instead
    const colRef = getUserItemsCollection(userId);

    return onSnapshot(colRef, (snapshot) => {
        const items: Item[] = [];
        snapshot.forEach((doc) => {
            items.push(doc.data() as Item);
        });
        // Sort by createdAt descending in memory
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        callback(items);
    }, (error) => {
        console.error('Firestore subscription error:', error);
    });
}

// ==========================================
// Settings CRUD
// ==========================================

const getUserSettingsDoc = (userId: string) =>
    doc(db, 'users', userId, 'settings', 'main');

export async function getSettings(userId: string): Promise<Settings | null> {
    const docSnap = await getDoc(getUserSettingsDoc(userId));
    if (docSnap.exists()) {
        return docSnap.data() as Settings;
    }
    return null;
}

export async function updateSettings(userId: string, settings: Settings): Promise<void> {
    // setDoc with merge: true to create if not exists
    await setDoc(getUserSettingsDoc(userId), settings, { merge: true });
}

// ==========================================
// Data Migration (localforage → Firestore)
// ==========================================

/**
 * Migrate existing local data to Firestore.
 * This runs once per user on first login.
 */
export async function migrateLocalData(
    userId: string,
    localItems: Item[],
    localSettings: Settings
): Promise<void> {
    // Check if user already has data in Firestore
    const existingSettings = await getSettings(userId);
    if (existingSettings) {
        // User already has cloud data, skip migration
        console.log('Cloud data exists, skipping migration');
        return;
    }

    if (localItems.length === 0) {
        // No local data to migrate, just save settings
        await updateSettings(userId, localSettings);
        console.log('No local items to migrate, saved settings only');
        return;
    }

    console.log(`Migrating ${localItems.length} items to Firestore...`);

    // Batch write items (max 500 per batch)
    const batchSize = 450;
    for (let i = 0; i < localItems.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = localItems.slice(i, i + batchSize);

        for (const item of chunk) {
            const docRef = getUserItemDoc(userId, item.id);
            batch.set(docRef, stripUndefined(item));
        }

        await batch.commit();
        console.log(`Migrated batch ${Math.floor(i / batchSize) + 1}`);
    }

    // Save settings
    await updateSettings(userId, localSettings);

    console.log('Migration complete!');
}

// ==========================================
// User Stats (persistent cumulative counters)
// ==========================================

const defaultStats: UserStats = {
    totalZaps: 0,
    totalProcessed: 0,
    totalTodos: 0,
    completedTodos: 0,
    totalStashed: 0,
};

const getUserStatsDoc = (userId: string) =>
    doc(db, 'users', userId, 'stats', 'main');

export async function getStats(userId: string): Promise<UserStats> {
    const docSnap = await getDoc(getUserStatsDoc(userId));
    if (docSnap.exists()) {
        return { ...defaultStats, ...docSnap.data() } as UserStats;
    }
    // Initialize stats doc if it doesn't exist
    await setDoc(getUserStatsDoc(userId), defaultStats);
    return { ...defaultStats };
}

/**
 * Atomically increment one or more stat counters.
 * Uses Firestore's `increment()` for safe concurrent updates.
 */
export async function incrementStats(
    userId: string,
    deltas: Partial<Record<keyof UserStats, number>>
): Promise<void> {
    const updates: Record<string, ReturnType<typeof increment>> = {};
    for (const [key, value] of Object.entries(deltas)) {
        if (value && value !== 0) {
            updates[key] = increment(value);
        }
    }
    if (Object.keys(updates).length > 0) {
        try {
            await updateDoc(getUserStatsDoc(userId), updates);
        } catch {
            // Doc might not exist yet, create it first
            await setDoc(getUserStatsDoc(userId), defaultStats);
            await updateDoc(getUserStatsDoc(userId), updates);
        }
    }
}
