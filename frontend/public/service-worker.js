// Service Worker - PWA com funcionalidades avançadas para Blocktrust
const CACHE_NAME = 'blocktrust-cache';
const RUNTIME_CACHE = 'blocktrust-runtime';
const POLYGON_CACHE = 'polygon-data';

// Assets essenciais para funcionamento offline
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Endpoints da API que podem ser cacheados
const CACHEABLE_API_ROUTES = [
  '/api/user/profile',
  '/api/identity/nft',
  '/api/documents/list'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando assets essenciais');
      return cache.addAll(ESSENTIAL_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== POLYGON_CACHE)
          .map((name) => {
            console.log(`[SW] Removendo cache antigo: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Estratégias de cache para diferentes tipos de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Estratégia 1: Network First para API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Estratégia 2: Cache First para assets estáticos
  if (request.destination === 'image' || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }
  
  // Estratégia 3: Stale While Revalidate para HTML
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  
  // Share Target API handler
  if (url.pathname === '/share' && request.method === 'POST') {
    event.respondWith(handleSharedDocument(request));
    return;
  }
  
  // Default: Network First
  event.respondWith(networkFirstStrategy(request));
});

// Estratégia Network First (API calls)
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    if (request.mode === 'navigate') {
      return cache.match('/offline.html');
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Você está offline. Alguns recursos podem não estar disponíveis.' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Estratégia Cache First (assets estáticos)
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('[SW] Asset não encontrado no cache nem na rede:', error);
    return new Response('', { status: 404 });
  }
}

// Estratégia Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  const cachedResponse = await cache.match(request);
  
  const networkResponsePromise = fetch(request).then((response) => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  return cachedResponse || networkResponsePromise;
}

// Background Sync para transações pendentes
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync triggered:', event.tag);
  
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
  
  if (event.tag === 'sync-documents') {
    event.waitUntil(syncPendingDocuments());
  }
  
  if (event.tag === 'sync-all') {
    event.waitUntil(Promise.all([
      syncPendingTransactions(),
      syncPendingDocuments()
    ]));
  }
});

// Sincronizar transações pendentes com a Polygon
async function syncPendingTransactions() {
  const db = await openIndexedDB();
  const transactions = await getAllFromStore(db, 'pendingTransactions');
  
  for (const tx of transactions) {
    try {
      const response = await fetch('/api/blockchain/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      
      if (response.ok) {
        await deleteFromStore(db, 'pendingTransactions', tx.id);
        
        await self.registration.showNotification('Transação Confirmada', {
          body: `Transação ${tx.id} foi confirmada na Polygon`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `tx-${tx.id}`,
          data: { txHash: tx.hash }
        });
      }
    } catch (error) {
      console.error('[SW] Erro ao sincronizar transação:', error);
    }
  }
}

// Sincronizar documentos pendentes
async function syncPendingDocuments() {
  const db = await openIndexedDB();
  const documents = await getAllFromStore(db, 'pendingDocuments');
  
  for (const doc of documents) {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      
      if (response.ok) {
        await deleteFromStore(db, 'pendingDocuments', doc.id);
      }
    } catch (error) {
      console.error('[SW] Erro ao sincronizar documento:', error);
    }
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'Blocktrust',
    body: 'Nova notificação',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png'
  };
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag || 'default',
      data: notificationData.data || {},
      actions: notificationData.actions || [],
      requireInteraction: notificationData.requireInteraction || false
    })
  );
});

// Ação de clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  let urlToOpen = '/';
  
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  } else if (event.notification.tag.startsWith('tx-')) {
    urlToOpen = `/transactions/${event.notification.tag.replace('tx-', '')}`;
  } else if (event.notification.tag.startsWith('doc-')) {
    urlToOpen = `/documents/${event.notification.tag.replace('doc-', '')}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-polygon-status') {
    event.waitUntil(checkPolygonNetworkStatus());
  }
  
  if (event.tag === 'update-gas-prices') {
    event.waitUntil(updateGasPrices());
  }
});

// Verificar status da rede Polygon
async function checkPolygonNetworkStatus() {
  try {
    const response = await fetch('https://rpc-amoy.polygon.technology/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[SW] Polygon network is online. Block:', parseInt(data.result, 16));
    }
  } catch (error) {
    console.error('[SW] Polygon network check failed:', error);
  }
}

// Atualizar preços de gas
async function updateGasPrices() {
  try {
    const response = await fetch('https://gasstation.polygon.technology/v2');
    if (response.ok) {
      const data = await response.json();
      const cache = await caches.open(POLYGON_CACHE);
      await cache.put('/gas-prices', new Response(JSON.stringify(data)));
    }
  } catch (error) {
    console.error('[SW] Failed to update gas prices:', error);
  }
}

// Share Target API handler
async function handleSharedDocument(request) {
  try {
    const formData = await request.formData();
    const document = formData.get('document');
    const title = formData.get('title') || 'Documento Compartilhado';
    
    if (document && document instanceof File) {
      const db = await openIndexedDB();
      await addToStore(db, 'sharedDocuments', {
        id: Date.now(),
        file: await document.arrayBuffer(),
        fileName: document.name,
        fileType: document.type,
        title: title,
        timestamp: Date.now()
      });
      
      return Response.redirect('/documents/sign?shared=true', 303);
    }
    
    return Response.redirect('/', 303);
  } catch (error) {
    console.error('[SW] Error handling shared document:', error);
    return Response.redirect('/', 303);
  }
}

// Helper: Abrir IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BlocktrustDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pendingTransactions')) {
        db.createObjectStore('pendingTransactions', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('pendingDocuments')) {
        db.createObjectStore('pendingDocuments', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('sharedDocuments')) {
        db.createObjectStore('sharedDocuments', { keyPath: 'id' });
      }
    };
  });
}

// Helper: Get all from store
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper: Add to store
function addToStore(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper: Delete from store
function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
