import { CategoryItem, ChannelItem, PlaylistSource } from '../types/iptv';

const DB_NAME = 'arn_iptv_pro_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_store';

function openCatalogDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveCatalogToIdb(
  key: 'playlists' | 'categories' | 'channels',
  data: PlaylistSource[] | CategoryItem[] | ChannelItem[]
): Promise<void> {
  try {
    const db = await openCatalogDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Fallback silently to localStorage snapshot
  }
}

export async function loadCatalogFromIdb<T>(
  key: 'playlists' | 'categories' | 'channels'
): Promise<T[] | null> {
  try {
    const db = await openCatalogDb();
    return await new Promise<T[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        const res = req.result;
        resolve(Array.isArray(res) ? (res as T[]) : null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}
