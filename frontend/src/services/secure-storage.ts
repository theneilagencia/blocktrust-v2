/**
 * @title Secure Storage Service
 * @dev Serviço de armazenamento seguro usando Web Crypto API e IndexedDB
 * @author Blocktrust Team
 * @notice Armazena wallets de forma segura no navegador usando criptografia
 */

import { ethers } from 'ethers';

export interface WalletStorageData {
  id: string;
  address: string;
  encryptedData: number[];
  iv: number[];
  salt: number[];
  timestamp: number;
  bioHashFingerprint: string; // Hash do bioHash para verificação
}

export interface StoredWalletData {
  privateKey: string;
  mnemonic?: string;
  bioHash: string;
}

export class SecureStorage {
  private static readonly DB_NAME = 'BlocktrustSecureVault';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'wallets';
  
  /**
   * Inicializa o IndexedDB
   */
  private static async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('address', 'address', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  /**
   * Deriva chave de criptografia da senha do usuário
   */
  private static async deriveKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey, salt: Uint8Array }> {
    const encoder = new TextEncoder();
    const saltBytes = salt || crypto.getRandomValues(new Uint8Array(16));
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 250000, // Alto para segurança
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    return { key: derivedKey, salt: saltBytes };
  }
  
  /**
   * Cria hash de verificação para o bioHash
   */
  private static async createBioHashFingerprint(bioHash: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(bioHash);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Salva wallet criptografada
   */
  static async saveWallet(
    wallet: ethers.Wallet, 
    password: string, 
    bioHash: string,
    mnemonic?: string
  ): Promise<void> {
    try {
      const db = await this.initDB();
      
      // Deriva chave de criptografia
      const { key, salt } = await this.deriveKey(password);
      
      // Gera IV aleatório para AES-GCM
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Dados sensíveis para criptografar
      const sensitiveData: StoredWalletData = {
        privateKey: wallet.privateKey,
        mnemonic: mnemonic,
        bioHash: bioHash
      };
      
      const encoder = new TextEncoder();
      const dataToEncrypt = encoder.encode(JSON.stringify(sensitiveData));
      
      // Criptografa os dados
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataToEncrypt
      );
      
      // Cria fingerprint do bioHash para verificação
      const bioHashFingerprint = await this.createBioHashFingerprint(bioHash);
      
      // Armazena no IndexedDB
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const storageData: WalletStorageData = {
        id: 'primary-wallet',
        address: wallet.address,
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
        salt: Array.from(salt),
        timestamp: Date.now(),
        bioHashFingerprint: bioHashFingerprint
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(storageData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Remove salt do localStorage (migração)
      localStorage.removeItem('blocktrust-salt');
      
      console.log('Wallet salva com sucesso:', wallet.address);
    } catch (error) {
      console.error('Erro ao salvar wallet:', error);
      throw new Error('Falha ao salvar wallet: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }
  
  /**
   * Recupera wallet descriptografada
   */
  static async loadWallet(password: string): Promise<{ wallet: ethers.Wallet, bioHash: string } | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const walletData = await new Promise<WalletStorageData | null>((resolve, reject) => {
        const request = store.get('primary-wallet');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      
      if (!walletData) {
        return null;
      }
      
      // Recupera salt do IndexedDB (novo) ou localStorage (legacy)
      let salt: Uint8Array;
      
      if (walletData.salt) {
        // Novo formato - salt no IndexedDB
        salt = new Uint8Array(walletData.salt);
      } else {
        // Formato legado - salt no localStorage
        const saltString = localStorage.getItem('blocktrust-salt');
        if (!saltString) {
          throw new Error('Salt não encontrado - dados corrompidos');
        }
        salt = new Uint8Array(saltString.split(',').map(Number));
      }
      
      // Deriva chave
      const { key } = await this.deriveKey(password, salt);
      
      // Prepara dados para descriptografia
      const iv = new Uint8Array(walletData.iv);
      const encryptedData = new Uint8Array(walletData.encryptedData);
      
      // Descriptografa
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      const sensitiveData: StoredWalletData = JSON.parse(decoder.decode(decryptedData));
      
      // Reconstrói wallet
      const wallet = new ethers.Wallet(sensitiveData.privateKey);
      
      // Verifica integridade do endereço
      if (wallet.address !== walletData.address) {
        throw new Error('Dados corrompidos - endereço não confere');
      }
      
      return {
        wallet,
        bioHash: sensitiveData.bioHash
      };
    } catch (error) {
      console.error('Erro ao carregar wallet:', error);
      if (error instanceof Error && error.message.includes('Senha incorreta')) {
        throw error;
      }
      return null;
    }
  }
  
  /**
   * Verifica se existe uma wallet armazenada
   */
  static async hasStoredWallet(): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const count = await new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return count > 0;
    } catch (error) {
      console.error('Erro ao verificar wallet armazenada:', error);
      return false;
    }
  }
  
  /**
   * Verifica se o bioHash corresponde à wallet armazenada
   */
  static async verifyBioHashMatch(bioHash: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const walletData = await new Promise<WalletStorageData | null>((resolve, reject) => {
        const request = store.get('primary-wallet');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      
      if (!walletData) {
        return false;
      }
      
      const bioHashFingerprint = await this.createBioHashFingerprint(bioHash);
      return bioHashFingerprint === walletData.bioHashFingerprint;
    } catch (error) {
      console.error('Erro ao verificar bioHash:', error);
      return false;
    }
  }
  
  /**
   * Atualiza a wallet com novos dados (para migração ou recovery)
   */
  static async updateWallet(
    newWallet: ethers.Wallet,
    password: string,
    bioHash: string,
    mnemonic?: string
  ): Promise<void> {
    // Remove wallet antiga
    await this.clearStorage();
    
    // Salva nova wallet
    await this.saveWallet(newWallet, password, bioHash, mnemonic);
  }
  

  
  /**
   * Limpa todos os dados armazenados
   */
  static async clearStorage(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Limpa localStorage relacionado (dados legados)
      localStorage.removeItem('blocktrust-salt');
      
      console.log('Storage limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar storage:', error);
      throw new Error('Falha ao limpar storage: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }
  
  /**
   * Exporta backup criptografado da wallet (para download)
   */
  static async exportBackup(password: string): Promise<string> {
    const walletData = await this.loadWallet(password);
    if (!walletData) {
      throw new Error('Nenhuma wallet encontrada');
    }
    
    const backupData = {
      address: walletData.wallet.address,
      bioHashFingerprint: await this.createBioHashFingerprint(walletData.bioHash),
      timestamp: Date.now(),
      version: '2.0'
    };
    
    return JSON.stringify(backupData, null, 2);
  }
  
  /**
   * Obtém informações não sensíveis da wallet armazenada
   */
  static async getWalletInfo(): Promise<{ address: string, timestamp: number } | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const walletData = await new Promise<WalletStorageData | null>((resolve, reject) => {
        const request = store.get('primary-wallet');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      
      if (!walletData) {
        return null;
      }
      
      return {
        address: walletData.address,
        timestamp: walletData.timestamp
      };
    } catch (error) {
      console.error('Erro ao obter info da wallet:', error);
      return null;
    }
  }
}
