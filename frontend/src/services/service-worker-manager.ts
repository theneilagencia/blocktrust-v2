/**
 * Service Worker Registration e Lifecycle Management
 */

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado neste navegador');
      return null;
    }

    try {
      // Registrar Service Worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registrado com sucesso:', this.registration.scope);

      // Verificar por atualizações
      this.registration.addEventListener('updatefound', () => {
        console.log('Nova versão do Service Worker encontrada');
        this.handleUpdate(this.registration!);
      });

      // Verificar atualizações periodicamente
      setInterval(() => {
        this.registration?.update();
      }, 60 * 60 * 1000); // A cada hora

      return this.registration;
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
      return null;
    }
  }

  private handleUpdate(registration: ServiceWorkerRegistration): void {
    const installingWorker = registration.installing;

    if (installingWorker) {
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Nova versão disponível
            console.log('Nova versão disponível. Atualize a página.');
            
            // Disparar evento customizado
            window.dispatchEvent(new CustomEvent('sw-update-available', {
              detail: { registration }
            }));
          } else {
            // Primeira instalação
            console.log('Service Worker instalado pela primeira vez');
          }
        }
      });
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const success = await this.registration.unregister();
      console.log('Service Worker desregistrado:', success);
      return success;
    } catch (error) {
      console.error('Erro ao desregistrar Service Worker:', error);
      return false;
    }
  }

  async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this.registration) {
      return this.registration;
    }

    if ('serviceWorker' in navigator) {
      return await navigator.serviceWorker.getRegistration();
    }

    return null;
  }

  async checkForUpdates(): Promise<void> {
    const registration = await this.getRegistration();
    if (registration) {
      await registration.update();
    }
  }

  // Background Sync
  async registerBackgroundSync(tag: string): Promise<void> {
    const registration = await this.getRegistration();
    
    if (registration && 'sync' in registration) {
      try {
        await (registration as any).sync.register(tag);
        console.log(`Background sync registrado: ${tag}`);
      } catch (error) {
        console.error('Erro ao registrar background sync:', error);
      }
    } else {
      console.warn('Background Sync não suportado');
    }
  }

  // Periodic Background Sync
  async registerPeriodicSync(tag: string, minInterval: number): Promise<void> {
    const registration = await this.getRegistration();
    
    if (registration && 'periodicSync' in registration) {
      try {
        await (registration as any).periodicSync.register(tag, {
          minInterval: minInterval
        });
        console.log(`Periodic sync registrado: ${tag}`);
      } catch (error) {
        console.error('Erro ao registrar periodic sync:', error);
      }
    } else {
      console.warn('Periodic Background Sync não suportado');
    }
  }

  // Skip Waiting
  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Status do Service Worker
  getStatus(): {
    isRegistered: boolean;
    isActive: boolean;
    hasUpdate: boolean;
  } {
    return {
      isRegistered: !!this.registration,
      isActive: !!this.registration?.active,
      hasUpdate: !!this.registration?.waiting
    };
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();
