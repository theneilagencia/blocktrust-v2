/**
 * IndexedDB Service para Blocktrust PWA
 * Gerencia armazenamento local de dados offline
 */

interface PendingTransaction {
  id: string;
  type: 'signature' | 'identity' | 'transfer';
  data: any;
  timestamp: number;
  synced: boolean;
}

interface PendingDocument {
  id: string;
  fileName: string;
  fileData: ArrayBuffer;
  fileType: string;
  timestamp: number;
  synced: boolean;
}

interface SharedDocument {
  id: string;
  file: ArrayBuffer;
  fileName: string;
  fileType: string;
  title: string;
  timestamp: number;
}

interface CachedIdentity {
  userId: string;
  nftId: string;
  data: any;
  lastUpdate: number;
}

class IndexedDBService {
  private dbName = 'BlocktrustDB';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB inicializado com sucesso');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para transações pendentes
        if (!db.objectStoreNames.contains('pendingTransactions')) {
          const txStore = db.createObjectStore('pendingTransactions', { keyPath: 'id' });
          txStore.createIndex('synced', 'synced', { unique: false });
          txStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para documentos pendentes
        if (!db.objectStoreNames.contains('pendingDocuments')) {
          const docStore = db.createObjectStore('pendingDocuments', { keyPath: 'id' });
          docStore.createIndex('synced', 'synced', { unique: false });
          docStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para documentos compartilhados
        if (!db.objectStoreNames.contains('sharedDocuments')) {
          const sharedStore = db.createObjectStore('sharedDocuments', { keyPath: 'id' });
          sharedStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para cache de identidades
        if (!db.objectStoreNames.contains('cachedIdentities')) {
          const identityStore = db.createObjectStore('cachedIdentities', { keyPath: 'userId' });
          identityStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
        }

        // Store para ações pendentes
        if (!db.objectStoreNames.contains('pendingActions')) {
          const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Transações Pendentes
  async savePendingTransaction(transaction: PendingTransaction): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingTransactions', 'readwrite');
      const store = tx.objectStore('pendingTransactions');
      const request = store.add(transaction);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingTransactions', 'readonly');
      const store = tx.objectStore('pendingTransactions');
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markTransactionAsSynced(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingTransactions', 'readwrite');
      const store = tx.objectStore('pendingTransactions');
      const request = store.get(id);

      request.onsuccess = () => {
        const transaction = request.result;
        if (transaction) {
          transaction.synced = true;
          const updateRequest = store.put(transaction);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Documentos Pendentes
  async savePendingDocument(document: PendingDocument): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingDocuments', 'readwrite');
      const store = tx.objectStore('pendingDocuments');
      const request = store.add(document);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingDocuments(): Promise<PendingDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pendingDocuments', 'readonly');
      const store = tx.objectStore('pendingDocuments');
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Documentos Compartilhados
  async saveSharedDocument(document: SharedDocument): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sharedDocuments', 'readwrite');
      const store = tx.objectStore('sharedDocuments');
      const request = store.add(document);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSharedDocuments(): Promise<SharedDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sharedDocuments', 'readonly');
      const store = tx.objectStore('sharedDocuments');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSharedDocument(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sharedDocuments', 'readwrite');
      const store = tx.objectStore('sharedDocuments');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache de Identidades
  async cacheIdentity(identity: CachedIdentity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedIdentities', 'readwrite');
      const store = tx.objectStore('cachedIdentities');
      const request = store.put(identity);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedIdentity(userId: string): Promise<CachedIdentity | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cachedIdentities', 'readonly');
      const store = tx.objectStore('cachedIdentities');
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Limpar dados antigos
  async clearOldData(daysOld: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const stores = ['pendingTransactions', 'pendingDocuments', 'sharedDocuments'];

    for (const storeName of stores) {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const indexedDB = new IndexedDBService();
export type { PendingTransaction, PendingDocument, SharedDocument, CachedIdentity };
