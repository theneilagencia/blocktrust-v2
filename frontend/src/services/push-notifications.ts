import { api } from './api';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  
  private constructor() {}
  
  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }
  
  /**
   * Inicializa o serviço de notificações
   */
  async initialize(): Promise<void> {
    // Verificar suporte
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações');
      return;
    }
    
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado');
      return;
    }
    
    if (!('PushManager' in window)) {
      console.warn('Push API não suportada');
      return;
    }
    
    // Registrar Service Worker
    this.registration = await navigator.serviceWorker.ready;
    
    // Verificar se já tem subscription
    this.subscription = await this.registration.pushManager.getSubscription();
    
    if (this.subscription) {
      console.log('Já inscrito para notificações push');
      await this.sendSubscriptionToServer(this.subscription);
    }
  }
  
  /**
   * Solicita permissão e inscreve para notificações
   */
  async requestPermission(): Promise<boolean> {
    // Solicitar permissão
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Permissão para notificações negada');
      return false;
    }
    
    // Inscrever para push notifications
    await this.subscribeToPush();
    return true;
  }
  
  /**
   * Inscreve para push notifications
   */
  private async subscribeToPush(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker não registrado');
    }
    
    try {
      // Obter chave pública VAPID do servidor
      const response = await api.get('/api/push/vapid-public-key');
      const vapidPublicKey = response.data.publicKey;
      
      // Converter para Uint8Array
      const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
      
      // Criar subscription
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      
      console.log('Inscrito para push notifications:', this.subscription);
      
      // Enviar subscription para o servidor
      await this.sendSubscriptionToServer(this.subscription);
      
    } catch (error) {
      console.error('Erro ao inscrever para push:', error);
      throw error;
    }
  }
  
  /**
   * Envia subscription para o servidor
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await api.post('/api/push/subscribe', {
        subscription: subscription.toJSON()
      });
      
      console.log('Subscription enviada para o servidor');
    } catch (error) {
      console.error('Erro ao enviar subscription:', error);
    }
  }
  
  /**
   * Cancela inscrição de notificações
   */
  async unsubscribe(): Promise<void> {
    if (!this.subscription) {
      return;
    }
    
    try {
      // Cancelar no navegador
      await this.subscription.unsubscribe();
      
      // Notificar servidor
      await api.post('/api/push/unsubscribe', {
        endpoint: this.subscription.endpoint
      });
      
      this.subscription = null;
      console.log('Desinscrição de push notifications concluída');
    } catch (error) {
      console.error('Erro ao cancelar inscrição:', error);
    }
  }
  
  /**
   * Verifica se está inscrito
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }
    
    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }
  
  /**
   * Envia notificação local (sem servidor)
   */
  async showLocalNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker não registrado');
    }
    
    if (Notification.permission !== 'granted') {
      throw new Error('Permissão para notificações não concedida');
    }
    
    await this.registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      ...options
    });
  }
  
  /**
   * Converte VAPID key
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
  
  /**
   * Tipos de notificações específicas do Blocktrust
   */
  async notifyTransactionComplete(txHash: string, amount: string): Promise<void> {
    await this.showLocalNotification('Transação Confirmada na Polygon! ✅', {
      body: `Sua transação de ${amount} MATIC foi confirmada`,
      tag: `tx-${txHash}`,
      data: { 
        url: `/transactions/${txHash}`,
        txHash 
      },
      actions: [
        {
          action: 'view',
          title: 'Ver Detalhes'
        },
        {
          action: 'share',
          title: 'Compartilhar'
        }
      ]
    });
  }
  
  async notifyDocumentSigned(documentId: string, signerName: string): Promise<void> {
    await this.showLocalNotification('Documento Assinado! 📝', {
      body: `${signerName} assinou seu documento`,
      tag: `doc-${documentId}`,
      data: { 
        url: `/documents/${documentId}`,
        documentId 
      },
      actions: [
        {
          action: 'view',
          title: 'Ver Documento'
        }
      ]
    });
  }
  
  async notifyIdentityVerified(): Promise<void> {
    await this.showLocalNotification('Identidade Verificada! 🎉', {
      body: 'Seu NFT de identidade foi criado na blockchain Polygon',
      tag: 'identity-verified',
      data: { url: '/identity' },
      requireInteraction: true
    });
  }
  
  async notifyGasPriceAlert(currentPrice: string, threshold: string): Promise<void> {
    await this.showLocalNotification('Preço de Gas Favorável ⛽', {
      body: `Gas está em ${currentPrice} gwei, abaixo do seu limite de ${threshold} gwei`,
      tag: 'gas-alert',
      data: { url: '/settings/gas' }
    });
  }
}

// Exportar instância singleton
export const pushNotifications = PushNotificationService.getInstance();
