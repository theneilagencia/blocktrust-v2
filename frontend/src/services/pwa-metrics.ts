export class PWAMetrics {
  static trackInstallation(): void {
    window.addEventListener('appinstalled', () => {
      console.log('PWA instalado');
      
      // Enviar para analytics
      if ('gtag' in window) {
        (window as any).gtag('event', 'pwa_install', {
          event_category: 'PWA',
          event_label: 'Installation'
        });
      }
      
      // Armazenar localmente
      localStorage.setItem('pwa-installed', 'true');
      localStorage.setItem('pwa-install-date', new Date().toISOString());
    });
  }
  
  static measurePerformance(): void {
    if ('performance' in window && 'measure' in window.performance) {
      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach((entry) => {
        console.log(`${entry.name}: ${entry.startTime}ms`);
      });
      
      // Largest Contentful Paint
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log(`LCP: ${lastEntry.startTime}ms`);
          
          if ('gtag' in window) {
            (window as any).gtag('event', 'lcp', {
              value: Math.round(lastEntry.startTime),
              event_category: 'Performance'
            });
          }
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP observer not supported');
      }
      
      // First Input Delay
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            const fid = entry.processingStart - entry.startTime;
            console.log(`FID: ${fid}ms`);
            
            if ('gtag' in window) {
              (window as any).gtag('event', 'fid', {
                value: Math.round(fid),
                event_category: 'Performance'
              });
            }
          });
        }).observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID observer not supported');
      }
    }
  }
  
  static checkPWACapabilities(): Record<string, boolean> {
    const capabilities = {
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      notifications: 'Notification' in window,
      backgroundSync: 'sync' in ServiceWorkerRegistration.prototype,
      periodicBackgroundSync: 'periodicSync' in ServiceWorkerRegistration.prototype,
      share: 'share' in navigator,
      installable: 'BeforeInstallPromptEvent' in window,
      webgl: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      })(),
      webRTC: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      geolocation: 'geolocation' in navigator,
      clipboard: 'clipboard' in navigator
    };
    
    console.log('PWA Capabilities:', capabilities);
    return capabilities;
  }
  
  static trackServiceWorkerState(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        console.log('Service Worker ativo:', registration.active?.state);
        
        registration.addEventListener('updatefound', () => {
          console.log('Nova versão do Service Worker encontrada');
          
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('Service Worker state:', newWorker.state);
            });
          }
        });
      });
    }
  }
  
  static trackOfflineUsage(): void {
    window.addEventListener('offline', () => {
      console.log('App entrou em modo offline');
      
      if ('gtag' in window) {
        (window as any).gtag('event', 'offline', {
          event_category: 'PWA',
          event_label: 'Network Status'
        });
      }
    });
    
    window.addEventListener('online', () => {
      console.log('App voltou online');
      
      if ('gtag' in window) {
        (window as any).gtag('event', 'online', {
          event_category: 'PWA',
          event_label: 'Network Status'
        });
      }
    });
  }
  
  static trackCacheUsage(): void {
    if ('caches' in window) {
      caches.keys().then((keys) => {
        console.log('Caches disponíveis:', keys);
        
        keys.forEach((key) => {
          caches.open(key).then((cache) => {
            cache.keys().then((requests) => {
              console.log(`Cache ${key}: ${requests.length} items`);
            });
          });
        });
      });
    }
  }
  
  static async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = (usage / quota * 100).toFixed(2);
      
      console.log('Storage usado:', {
        usage: `${(usage / 1024 / 1024).toFixed(2)} MB`,
        quota: `${(quota / 1024 / 1024).toFixed(2)} MB`,
        percentUsed: `${percentUsed}%`
      });
      
      return estimate;
    }
    
    return null;
  }
  
  static initializeAll(): void {
    this.trackInstallation();
    this.measurePerformance();
    this.checkPWACapabilities();
    this.trackServiceWorkerState();
    this.trackOfflineUsage();
    this.trackCacheUsage();
    
    // Verificar storage a cada 5 minutos
    setInterval(() => {
      this.getStorageEstimate();
    }, 5 * 60 * 1000);
  }
}
