import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Smartphone, Monitor, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  useEffect(() => {
    // Detectar plataforma
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
    
    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    
    // Verificar se foi instalado via navigator
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
        if (apps.length > 0) {
          setIsInstalled(true);
        }
      });
    }
    
    // Capturar evento de instalação (Chrome/Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar prompt customizado após 30 segundos
      setTimeout(() => {
        if (!localStorage.getItem('pwa-prompt-dismissed')) {
          setShowPrompt(true);
        }
      }, 30000);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // Detectar quando app foi instalado
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      console.log('PWA foi instalado');
    });
    
    // Para iOS, mostrar instruções manuais
    if (platform === 'ios' && !isInstalled) {
      const isInStandaloneMode = ('standalone' in window.navigator) && 
                                 (window.navigator as any).standalone;
      if (!isInStandaloneMode && !localStorage.getItem('ios-prompt-shown')) {
        setTimeout(() => {
          setShowIOSInstructions(true);
          localStorage.setItem('ios-prompt-shown', 'true');
        }, 5000);
      }
    }
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [platform, isInstalled]);
  
  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.log('Prompt de instalação não disponível');
      return;
    }
    
    // Mostrar prompt nativo
    deferredPrompt.prompt();
    
    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };
  
  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };
  
  if (isInstalled) {
    return null;
  }
  
  return (
    <>
      {/* Prompt para Android/Desktop */}
      <AnimatePresence>
        {showPrompt && platform !== 'ios' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
          >
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    {platform === 'android' ? (
                      <Smartphone className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Monitor className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Instalar Blocktrust
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Instale o app para acesso rápido, funcionamento offline e notificações.
                  </p>
                  
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center text-xs text-gray-500">
                      <Check className="w-3 h-3 mr-1 text-green-500" />
                      Funciona offline
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Check className="w-3 h-3 mr-1 text-green-500" />
                      Acesso rápido na tela inicial
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Check className="w-3 h-3 mr-1 text-green-500" />
                      Notificações de transações
                    </div>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={handleInstall}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Instalar
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                    >
                      Agora não
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Instruções para iOS */}
      <AnimatePresence>
        {showIOSInstructions && platform === 'ios' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              <h3 className="text-xl font-bold text-center mb-4">
                Instalar Blocktrust no iPhone
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <p className="text-gray-800">
                      Toque no botão <strong>Compartilhar</strong> 
                      <svg className="inline w-5 h-5 mx-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.522 1.732m5.522-8.726a9.001 9.001 0 017.522-1.732M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      na barra inferior do Safari
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <p className="text-gray-800">
                      Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="text-gray-800">
                      Toque em <strong>"Adicionar"</strong> no canto superior direito
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg font-semibold"
              >
                Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
