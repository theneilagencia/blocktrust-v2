import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

export const UpdatePrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Verificar por atualizações a cada 60 segundos
        setInterval(() => {
          registration.update();
        }, 60000);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão disponível
                setWaitingWorker(newWorker);
                setShowPrompt(true);
              }
            });
          }
        });
        
        // Verificar se já existe um worker esperando
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowPrompt(true);
        }
      });
      
      // Listener para quando controlador mudar
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);
  
  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };
  
  const handleDismiss = () => {
    setShowPrompt(false);
  };
  
  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="bg-blue-600 text-white rounded-lg shadow-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Nova Versão Disponível</h3>
                  <p className="text-sm text-blue-100">
                    Uma nova versão do Blocktrust está pronta. Atualize agora para obter 
                    as últimas melhorias e recursos.
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-blue-700 rounded-full transition ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-4 flex space-x-2">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                Atualizar Agora
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-white hover:bg-blue-700 rounded-lg transition"
              >
                Depois
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
