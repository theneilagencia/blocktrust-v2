import { DeterministicWalletGenerator, RateLimitConfig } from '../wallet-generator';
import { ethers } from 'ethers';

// Mock CryptoJS
jest.mock('crypto-js', () => ({
  PBKDF2: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
  }),
  algo: {
    SHA256: {}
  },
  enc: {
    Hex: 'hex'
  }
}));

// Mock ethers Wallet
jest.mock('ethers', () => ({
  ethers: {
    Wallet: jest.fn().mockImplementation((privateKey: string) => ({
      address: '0x' + privateKey.slice(2, 42),
      privateKey: privateKey,
      signingKey: { publicKey: '0x...' }
    }))
  }
}));

describe('DeterministicWalletGenerator - Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limiting before each test
    DeterministicWalletGenerator['attemptHistory'].clear();
    DeterministicWalletGenerator['cooldowns'].clear();
  });

  const validBioHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  describe('Rate Limiting Configuration', () => {
    it('deve usar configuração padrão corretamente', () => {
      const status = DeterministicWalletGenerator.checkRateLimit();
      
      expect(status.isLimited).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.nextAttemptAllowedAt).toBe(0);
    });

    it('deve aceitar configuração customizada', () => {
      const customConfig: RateLimitConfig = {
        maxAttempts: 3,
        windowMs: 30000, // 30 segundos
        cooldownMs: 60000 // 1 minuto
      };

      const status = DeterministicWalletGenerator.checkRateLimit('test-user', customConfig);
      
      expect(status.attemptsRemaining).toBe(3);
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('deve permitir tentativas dentro do limite', () => {
      // Primeiras 5 tentativas devem passar
      for (let i = 0; i < 5; i++) {
        expect(() => {
          DeterministicWalletGenerator.generateWallet(validBioHash, {}, `test-${i}`);
        }).not.toThrow();
      }
    });

    it('deve bloquear tentativas após atingir limite', () => {
      const config: RateLimitConfig = {
        maxAttempts: 2,
        windowMs: 60000,
        cooldownMs: 30000
      };

      // Usa mesmo identifier para acumular tentativas
      const identifier = 'test-user';

      // Primeiras 2 tentativas OK
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).not.toThrow();

      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).not.toThrow();

      // 3ª tentativa deve falhar
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).toThrow(/Rate limit atingido/);
    });

    it('deve aplicar cooldown após esgotar tentativas', () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60000,
        cooldownMs: 5000 // 5 segundos
      };

      const identifier = 'cooldown-test';

      // Primeira tentativa OK
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);

      // Segunda tentativa deve iniciar cooldown
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).toThrow();

      // Verifica status do cooldown
      const status = DeterministicWalletGenerator.checkRateLimit(identifier, config);
      expect(status.isLimited).toBe(true);
      expect(status.cooldownEndsAt).toBeGreaterThan(Date.now());
    });

    it('deve resetar tentativas após janela de tempo', async () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 50, // 50ms para teste rápido
      };

      const identifier = 'window-test';

      // Primeira tentativa
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);

      // Segunda tentativa imediata deve falhar
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).toThrow();

      // Aguarda janela passar
      await new Promise(resolve => setTimeout(resolve, 100));

      // Deve permitir novamente
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).not.toThrow();
    });

    it('deve rastrear tentativas por identifier', () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60000
      };

      // User 1 usa seu limite
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, 'user1', config);
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, 'user1', config);
      }).toThrow();

      // User 2 ainda deve ter tentativas disponíveis
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, 'user2', config);
      }).not.toThrow();
    });
  });

  describe('Rate Limit Status', () => {
    it('deve retornar status correto antes de atingir limite', () => {
      const status = DeterministicWalletGenerator.checkRateLimit('status-test');
      
      expect(status.isLimited).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.nextAttemptAllowedAt).toBe(0);
    });

    it('deve retornar status correto durante cooldown', () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60000,
        cooldownMs: 10000
      };

      const identifier = 'status-cooldown';

      // Esgota limite
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      
      try {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      } catch (e) {
        // Esperado
      }

      const status = DeterministicWalletGenerator.checkRateLimit(identifier, config);
      
      expect(status.isLimited).toBe(true);
      expect(status.attemptsRemaining).toBe(0);
      expect(status.cooldownEndsAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Integration with Wallet Generation', () => {
    it('deve manter funcionalidade original quando rate limit não é atingido', () => {
      const wallet = DeterministicWalletGenerator.generateWallet(validBioHash, {}, 'integration-test');
      
      expect(wallet).toBeInstanceOf(ethers.Wallet);
      expect(wallet.address).toBeDefined();
      expect(wallet.privateKey).toBeDefined();
    });

    it('deve funcionar com todas as outras funções', () => {
      const identifier = 'full-integration';
      
      // generateAddress
      const address = DeterministicWalletGenerator.generateAddress(validBioHash, {}, identifier);
      expect(address).toBeDefined();
      
      // validateAddressForBioHash
      const isValid = DeterministicWalletGenerator.validateAddressForBioHash(
        address, 
        validBioHash, 
        {}, 
        identifier + '-validation'
      );
      expect(isValid).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('deve fornecer mensagem de erro clara para rate limiting', () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60000
      };

      const identifier = 'error-test';

      // Primeira tentativa OK
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);

      // Segunda tentativa deve ter erro claro
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).toThrow(/Rate limit atingido.*segundos.*Tentativas restantes: 0/);
    });

    it('deve fornecer mensagem de erro clara para cooldown', () => {
      const config: RateLimitConfig = {
        maxAttempts: 1,
        windowMs: 60000,
        cooldownMs: 10000
      };

      const identifier = 'cooldown-error-test';

      // Esgota limite
      DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);

      // Trigger cooldown
      try {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      } catch (e) {
        // Esperado
      }

      // Tentativa durante cooldown deve ter mensagem específica
      expect(() => {
        DeterministicWalletGenerator.generateWallet(validBioHash, {}, identifier, config);
      }).toThrow(/Rate limit atingido.*segundos/);
    });
  });
});
