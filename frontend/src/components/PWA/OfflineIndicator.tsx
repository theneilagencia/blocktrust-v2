import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, AlertCircle, RefreshCw } from 'lucide-react';

interface NetworkStatus {
  isOnline: boolean;
  isPolygonReachable: boolean;
  lastSync: number | null;
}

interface PendingAction {
  id: string;
  type: string;
  description: string;
  timestamp: number;
}

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isPolygonReachable, lastSync } = useNetworkStatus();
  const [showDetails, setShowDetails] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  
  useEffect(() => {
    loadPendingActions();
  }, [isOnline]);
  
  const loadPendingActions = async () => {
    try {
      const db = await openIndexedDB();
      const pending = await getPendingActions(db);
      setPendingActions(pending);
    } catch (error) {
      console.error('Erro ao carregar ações pendentes:', error);
    }
  };
  
  const syncNow = async () => {
    if (!isOnline) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await registration.sync.register('sync-all');
      }
      
      await loadPendingActions();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    }
  };
  
  if (isOnline && !pendingActions.length) {
    return null;
  }
  
  return (
    <>
      {/* Indicador compacto */}
      <div className="fixed top-4 right-4 z-50">
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center cursor-pointer"
              onClick={() => setShowDetails(true)}
            >
              <WifiOff className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Offline</span>
            </motion.div>
          )}
          
          {isOnline && !isPolygonReachable && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center cursor-pointer"
              onClick={() => setShowDetails(true)}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Polygon Desconectada</span>
            </motion.div>
          )}
          
          {isOnline && pendingActions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center cursor-pointer"
              onClick={() => setShowDetails(true)}
            >
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-sm font-medium">
                {pendingActions.length} ações pendentes
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Modal de detalhes */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                {!isOnline ? (
                  <>
                    <WifiOff className="w-5 h-5 mr-2 text-red-500" />
                    Modo Offline
                  </>
                ) : (
                  <>
                    <Wifi className="w-5 h-5 mr-2 text-green-500" />
                    Status da Conexão
                  </>
                )}
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Internet</span>
                  <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Polygon Network</span>
                  <span className={`text-sm font-medium ${isPolygonReachable ? 'text-green-600' : 'text-yellow-600'}`}>
                    {isPolygonReachable ? 'Conectado' : 'Inacessível'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Última Sincronização</span>
                  <span className="text-sm font-medium">
                    {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Nunca'}
                  </span>
                </div>
                
                {pendingActions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Ações Pendentes ({pendingActions.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {pendingActions.map((action) => (
                        <div key={action.id} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                          {action.type}: {action.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!isOnline && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Modo Offline Ativo:</strong> Suas ações estão sendo salvas 
                      localmente e serão sincronizadas quando a conexão for restaurada.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex space-x-3">
                {isOnline && pendingActions.length > 0 && (
                  <button
                    onClick={syncNow}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar Agora
                  </button>
                )}
                
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Hook para monitorar status da rede
function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPolygonReachable, setIsPolygonReachable] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Verificar conectividade com Polygon
    const checkPolygon = async () => {
      try {
        const response = await fetch('https://rpc-amoy.polygon.technology/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'net_version',
            params: [],
            id: 1
          })
        });
        
        setIsPolygonReachable(response.ok);
        if (response.ok) {
          setLastSync(Date.now());
        }
      } catch {
        setIsPolygonReachable(false);
      }
    };
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkPolygon, 30000);
    checkPolygon();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);
  
  return { isOnline, isPolygonReachable, lastSync };
}

// Helper: IndexedDB
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BlocktrustDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingActions(db: IDBDatabase): Promise<PendingAction[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pendingActions', 'readonly');
    const store = transaction.objectStore('pendingActions');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
