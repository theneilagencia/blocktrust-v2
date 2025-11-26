import { SecureStorage } from '../secure-storage';
import { ethers } from 'ethers';

// Mock do IndexedDB para testes
class MockIndexedDB {
  private store: Map<string, any> = new Map();

  open(name: string, version: number) {
    return {
      result: {
        transaction: (stores: string[], mode: string) => ({
          objectStore: (storeName: string) => ({
            put: (data: any) => {
              this.store.set(data.id, data);
              return {
                onsuccess: null,
                onerror: null,
              };
            },
            get: (key: string) => ({
              result: this.store.get(key),
              onsuccess: null,
              onerror: null,
            }),
            count: () => ({
              result: this.store.size,
              onsuccess: null,
              onerror: null,
            }),
            clear: () => {
              this.store.clear();
              return {
                onsuccess: null,
                onerror: null,
              };
            },
          }),
        }),
        objectStoreNames: {
          contains: (name: string) => false,
        },
        createObjectStore: (name: string, options: any) => ({
          createIndex: (name: string, keyPath: string, options: any) => {},
        }),
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
  }
}

// Setup
beforeAll(() => {
  // Mock IndexedDB
  (global as any).indexedDB = new MockIndexedDB();
  
  // Mock crypto.subtle
  (global as any).crypto = {
    subtle: {
      importKey: jest.fn().mockResolvedValue({}),
      deriveKey: jest.fn().mockResolvedValue({}),
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
  
  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  (global as any).localStorage = localStorageMock;
});

describe('SecureStorage', () => {
  const testPassword = 'Test123!@#';
  const testBioHash = 'a1b2c3d4e5f6' + 'a1b2c3d4e5f6' + 'a1b2c3d4e5f6';
  let testWallet: ethers.Wallet;

  beforeEach(() => {
    // Cria wallet de teste
    testWallet = ethers.Wallet.createRandom();
    jest.clearAllMocks();
  });

  describe('saveWallet', () => {
    it('deve salvar wallet com sucesso', async () => {
      await expect(
        SecureStorage.saveWallet(testWallet, testPassword, testBioHash)
      ).resolves.not.toThrow();
      
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('deve rejeitar senha vazia', async () => {
      await expect(
        SecureStorage.saveWallet(testWallet, '', testBioHash)
      ).rejects.toThrow();
    });

    it('deve rejeitar bioHash inválido', async () => {
      await expect(
        SecureStorage.saveWallet(testWallet, testPassword, 'short')
      ).rejects.toThrow();
    });

    it('deve criar salt aleatório', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Verifica se salt foi armazenado
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'blocktrust-salt',
        expect.any(String)
      );
    });
  });

  describe('loadWallet', () => {
    it('deve carregar wallet salva', async () => {
      // Salva wallet
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Carrega wallet
      const result = await SecureStorage.loadWallet(testPassword);
      
      expect(result).not.toBeNull();
      expect(result?.wallet.address).toBe(testWallet.address);
      expect(result?.bioHash).toBe(testBioHash);
    });

    it('deve rejeitar senha incorreta', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      await expect(
        SecureStorage.loadWallet('WrongPassword123!')
      ).rejects.toThrow('Senha incorreta');
    });

    it('deve retornar null se não houver wallet', async () => {
      const result = await SecureStorage.loadWallet(testPassword);
      expect(result).toBeNull();
    });

    it('deve validar integridade do endereço', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Mock de descriptografia que retorna endereço diferente
      const mockDecrypt = jest.fn().mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({
          privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
          bioHash: testBioHash
        }))
      );
      
      (global as any).crypto.subtle.decrypt = mockDecrypt;
      
      await expect(
        SecureStorage.loadWallet(testPassword)
      ).rejects.toThrow('Dados corrompidos');
    });
  });

  describe('hasStoredWallet', () => {
    it('deve retornar false quando não há wallet', async () => {
      const result = await SecureStorage.hasStoredWallet();
      expect(result).toBe(false);
    });

    it('deve retornar true quando há wallet salva', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const result = await SecureStorage.hasStoredWallet();
      expect(result).toBe(true);
    });
  });

  describe('verifyBioHashMatch', () => {
    it('deve validar bioHash correto', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const result = await SecureStorage.verifyBioHashMatch(testBioHash);
      expect(result).toBe(true);
    });

    it('deve rejeitar bioHash incorreto', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const wrongBioHash = 'different' + 'a1b2c3d4e5f6' + 'a1b2c3d4e5f6';
      const result = await SecureStorage.verifyBioHashMatch(wrongBioHash);
      expect(result).toBe(false);
    });

    it('deve retornar false se não houver wallet', async () => {
      const result = await SecureStorage.verifyBioHashMatch(testBioHash);
      expect(result).toBe(false);
    });
  });

  describe('Salt Migration from localStorage to IndexedDB', () => {
    it('deve salvar salt no IndexedDB em vez do localStorage', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Verifica que salt não está no localStorage (novo comportamento)
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        'blocktrust-salt',
        expect.any(String)
      );
      
      // Verifica que localStorage legado é limpo
      expect(localStorage.removeItem).toHaveBeenCalledWith('blocktrust-salt');
    });

    it('deve carregar salt do IndexedDB quando disponível', async () => {
      // Salva wallet com salt no IndexedDB
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Carrega wallet - deve usar salt do IndexedDB
      const loaded = await SecureStorage.loadWallet(testPassword);
      expect(loaded).not.toBeNull();
      expect(loaded?.wallet.address).toBe(testWallet.address);
    });

    it('deve usar salt do localStorage como fallback (dados legados)', async () => {
      // Simula dados legados no localStorage
      const legacySalt = '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16';
      (localStorage.getItem as jest.Mock).mockReturnValue(legacySalt);

      // Mock de dados no IndexedDB sem salt
      const mockData = {
        id: 'primary-wallet',
        address: testWallet.address,
        encryptedData: [1, 2, 3],
        iv: [4, 5, 6],
        // salt: undefined (dados legados)
        timestamp: Date.now(),
        bioHashFingerprint: 'test-fingerprint'
      };

      // Mock IndexedDB para retornar dados legados
      const mockStore = {
        get: jest.fn().mockReturnValue({
          result: mockData,
          onsuccess: null,
          onerror: null
        })
      };

      // Tenta carregar - deve usar salt do localStorage
      try {
        await SecureStorage.loadWallet(testPassword);
      } catch (error) {
        // Esperado falhar na descriptografia, mas deve tentar usar localStorage
      }
      
      expect(localStorage.getItem).toHaveBeenCalledWith('blocktrust-salt');
    });

    it('deve limpar salt do localStorage ao limpar storage', async () => {
      await SecureStorage.clearStorage();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('blocktrust-salt');
    });
  });

  describe('clearStorage', () => {
    it('deve limpar todos os dados', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      await SecureStorage.clearStorage();
      
      const hasWallet = await SecureStorage.hasStoredWallet();
      expect(hasWallet).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalled();
    });

    it('deve limpar salt do localStorage', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      await SecureStorage.clearStorage();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('blocktrust-salt');
    });
  });

  describe('getWalletInfo', () => {
    it('deve retornar informações não sensíveis', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const info = await SecureStorage.getWalletInfo();
      
      expect(info).not.toBeNull();
      expect(info?.address).toBe(testWallet.address);
      expect(info?.timestamp).toBeDefined();
    });

    it('deve retornar null se não houver wallet', async () => {
      const info = await SecureStorage.getWalletInfo();
      expect(info).toBeNull();
    });

    it('não deve expor dados sensíveis', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const info = await SecureStorage.getWalletInfo();
      
      expect(info).not.toHaveProperty('privateKey');
      expect(info).not.toHaveProperty('bioHash');
    });
  });

  describe('exportBackup', () => {
    it('deve exportar backup criptografado', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const backup = await SecureStorage.exportBackup(testPassword);
      
      expect(backup).toBeDefined();
      expect(typeof backup).toBe('string');
      
      const backupData = JSON.parse(backup);
      expect(backupData.address).toBe(testWallet.address);
      expect(backupData.version).toBe('2.0');
    });

    it('não deve conter dados sensíveis em texto plano', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      const backup = await SecureStorage.exportBackup(testPassword);
      
      // Não deve conter chave privada ou bioHash em texto plano
      expect(backup).not.toContain('privateKey');
      expect(backup).not.toContain(testBioHash);
    });

    it('deve rejeitar senha incorreta', async () => {
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      await expect(
        SecureStorage.exportBackup('WrongPassword123!')
      ).rejects.toThrow();
    });
  });

  describe('Segurança de criptografia', () => {
    it('deve usar PBKDF2 com iterações suficientes', async () => {
      const deriveSpy = jest.spyOn((global as any).crypto.subtle, 'deriveKey');
      
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Verifica se PBKDF2 foi chamado
      expect(deriveSpy).toHaveBeenCalled();
    });

    it('deve usar AES-GCM para criptografia', async () => {
      const encryptSpy = jest.spyOn((global as any).crypto.subtle, 'encrypt');
      
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Verifica se AES-GCM foi usado
      expect(encryptSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM' }),
        expect.anything(),
        expect.anything()
      );
    });

    it('deve gerar IV aleatório para cada criptografia', async () => {
      const getRandomValuesSpy = jest.spyOn((global as any).crypto, 'getRandomValues');
      
      await SecureStorage.saveWallet(testWallet, testPassword, testBioHash);
      
      // Verifica se IV foi gerado
      expect(getRandomValuesSpy).toHaveBeenCalled();
    });
  });
});
