import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    writeBatch,
    getDoc,
    getDocs,
    updateDoc,
    increment
} from 'firebase/firestore';
import { db } from './firebase';
import type {
    Item,
    Settings,
    ThoughtContainer,
    ThoughtEntry,
    UserStats,
} from '../types';

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
    await deleteItemsByDocRefs(itemIds.map((itemId) => getUserItemDoc(userId, itemId)));
}

async function deleteItemsByDocRefs(docRefs: Array<ReturnType<typeof doc>>): Promise<void> {
    const batchSize = 450;
    for (let i = 0; i < docRefs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = docRefs.slice(i, i + batchSize);

        for (const docRef of chunk) {
            batch.delete(docRef);
        }

        await batch.commit();
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(docRefs.length / batchSize)}`);
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

const getUserThoughtContainersCollection = (userId: string) =>
    collection(db, 'users', userId, 'thoughtContainers');

const getUserThoughtContainerDoc = (userId: string, containerId: string) =>
    doc(db, 'users', userId, 'thoughtContainers', containerId);

const getUserThoughtEntriesCollection = (userId: string) =>
    collection(db, 'users', userId, 'thoughtEntries');

const getUserThoughtEntryDoc = (userId: string, entryId: string) =>
    doc(db, 'users', userId, 'thoughtEntries', entryId);

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
// Thought Containers / Entries
// ==========================================

export function subscribeToThoughtContainers(
    userId: string,
    callback: (containers: ThoughtContainer[]) => void
): () => void {
    const colRef = getUserThoughtContainersCollection(userId);

    return onSnapshot(colRef, (snapshot) => {
        const containers: ThoughtContainer[] = [];
        snapshot.forEach((doc) => {
            containers.push(doc.data() as ThoughtContainer);
        });
        containers.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(containers);
    }, (error) => {
        console.error('Thought container subscription error:', error);
    });
}

export function subscribeToThoughtEntries(
    userId: string,
    callback: (entries: ThoughtEntry[]) => void
): () => void {
    const colRef = getUserThoughtEntriesCollection(userId);

    return onSnapshot(colRef, (snapshot) => {
        const entries: ThoughtEntry[] = [];
        snapshot.forEach((doc) => {
            entries.push(doc.data() as ThoughtEntry);
        });
        entries.sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));
        callback(entries);
    }, (error) => {
        console.error('Thought entry subscription error:', error);
    });
}

export async function addThoughtContainer(userId: string, container: ThoughtContainer): Promise<void> {
    await setDoc(getUserThoughtContainerDoc(userId, container.id), stripUndefined(container));
}

export async function updateThoughtContainer(
    userId: string,
    containerId: string,
    updates: Partial<ThoughtContainer>
): Promise<void> {
    await setDoc(getUserThoughtContainerDoc(userId, containerId), stripUndefined(updates), { merge: true });
}

export async function deleteThoughtContainer(userId: string, containerId: string): Promise<void> {
    await deleteDoc(getUserThoughtContainerDoc(userId, containerId));
}

export async function addThoughtEntry(userId: string, entry: ThoughtEntry): Promise<void> {
    await setDoc(getUserThoughtEntryDoc(userId, entry.id), stripUndefined(entry));
}

export async function updateThoughtEntry(
    userId: string,
    entryId: string,
    updates: Partial<ThoughtEntry>
): Promise<void> {
    await setDoc(getUserThoughtEntryDoc(userId, entryId), stripUndefined(updates), { merge: true });
}

export async function deleteThoughtEntry(userId: string, entryId: string): Promise<void> {
    await deleteDoc(getUserThoughtEntryDoc(userId, entryId));
}

export async function deleteThoughtEntriesByContainer(userId: string, containerId: string): Promise<void> {
    const snapshot = await getDocs(getUserThoughtEntriesCollection(userId));
    const targetDocRefs = snapshot.docs
        .filter((docSnap) => (docSnap.data() as ThoughtEntry).containerId === containerId)
        .map((docSnap) => getUserThoughtEntryDoc(userId, docSnap.id));

    if (targetDocRefs.length === 0) return;

    await deleteItemsByDocRefs(targetDocRefs);
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

/**
 * Overwrite stats with specific values (for manual reset).
 */
export async function resetStats(
    userId: string,
    stats: UserStats
): Promise<void> {
    await setDoc(getUserStatsDoc(userId), stats);
}
