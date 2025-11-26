/**
 * @title Deterministic Wallet Generator
 * @dev Gera wallets determinísticas baseadas em bioHash biométrico
 * @author Blocktrust Team
 * @notice Sistema self-custodial que elimina armazenamento de chaves privadas
 */

import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

export interface WalletGenerationOptions {
  salt?: string;
  iterations?: number;
  keyLength?: number;
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  cooldownMs?: number;
}

export interface RateLimitStatus {
  isLimited: boolean;
  attemptsRemaining: number;
  nextAttemptAllowedAt: number;
  cooldownEndsAt?: number;
}

export class DeterministicWalletGenerator {
  private static readonly DEFAULT_SALT = 'blocktrust-deterministic';
  private static readonly DEFAULT_ITERATIONS = 100000;
  private static readonly DEFAULT_KEY_LENGTH = 32; // 256 bits

  // Rate limiting configuration
  private static readonly DEFAULT_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5, // 5 tentativas
    windowMs: 60 * 1000, // por minuto
    cooldownMs: 5 * 60 * 1000 // 5 minutos de cooldown se esgotar
  };

  private static attemptHistory: Map<string, number[]> = new Map();
  private static cooldowns: Map<string, number> = new Map();

  /**
   * Verifica e aplica rate limiting para geração de wallet
   * @param identifier - Identificador único (pode ser IP, user ID, etc.)
   * @param config - Configuração de rate limiting
   * @returns Status do rate limiting
   */
  static checkRateLimit(
    identifier: string = 'default',
    config: RateLimitConfig = this.DEFAULT_RATE_LIMIT
  ): RateLimitStatus {
    const now = Date.now();
    
    // Verifica se está em cooldown
    const cooldownEnd = this.cooldowns.get(identifier);
    if (cooldownEnd && now < cooldownEnd) {
      return {
        isLimited: true,
        attemptsRemaining: 0,
        nextAttemptAllowedAt: cooldownEnd,
        cooldownEndsAt: cooldownEnd
      };
    }

    // Remove cooldown expirado
    if (cooldownEnd && now >= cooldownEnd) {
      this.cooldowns.delete(identifier);
    }

    // Recupera histórico de tentativas
    let attempts = this.attemptHistory.get(identifier) || [];
    
    // Remove tentativas antigas fora da janela
    attempts = attempts.filter(time => now - time < config.windowMs);
    this.attemptHistory.set(identifier, attempts);

    // Verifica se atingiu o limite
    if (attempts.length >= config.maxAttempts) {
      // Inicia cooldown se configurado
      if (config.cooldownMs) {
        const cooldownEnd = now + config.cooldownMs;
        this.cooldowns.set(identifier, cooldownEnd);
        return {
          isLimited: true,
          attemptsRemaining: 0,
          nextAttemptAllowedAt: cooldownEnd,
          cooldownEndsAt: cooldownEnd
        };
      }

      // Sem cooldown - aguarda janela deslizante
      const oldestAttempt = Math.min(...attempts);
      const nextAllowed = oldestAttempt + config.windowMs;
      return {
        isLimited: true,
        attemptsRemaining: 0,
        nextAttemptAllowedAt: nextAllowed
      };
    }

    return {
      isLimited: false,
      attemptsRemaining: config.maxAttempts - attempts.length,
      nextAttemptAllowedAt: 0
    };
  }

  /**
   * Registra uma tentativa de geração
   * @param identifier - Identificador único
   */
  private static recordAttempt(identifier: string = 'default'): void {
    const attempts = this.attemptHistory.get(identifier) || [];
    attempts.push(Date.now());
    this.attemptHistory.set(identifier, attempts);
  }

  /**
   * Gera uma wallet determinística baseada no bioHash
   * @param bioHash - Hash biométrico único do usuário (do Sumsub)
   * @param options - Opções de configuração
   * @param identifier - Identificador para rate limiting
   * @param rateLimitConfig - Configuração de rate limiting
   * @returns Wallet Ethereum determinística
   */
  static generateWallet(
    bioHash: string, 
    options: WalletGenerationOptions = {},
    identifier: string = 'default',
    rateLimitConfig?: RateLimitConfig
  ): ethers.Wallet {
    // Aplica rate limiting
    const rateLimit = this.checkRateLimit(identifier, rateLimitConfig);
    if (rateLimit.isLimited) {
      const remainingTime = Math.ceil((rateLimit.nextAttemptAllowedAt - Date.now()) / 1000);
      throw new Error(
        `Rate limit atingido. Próxima tentativa permitida em ${remainingTime} segundos. ` +
        `Tentativas restantes: ${rateLimit.attemptsRemaining}`
      );
    }

    // Registra a tentativa
    this.recordAttempt(identifier);

    // Validações existentes
    if (!bioHash || bioHash.length < 32) {
      throw new Error('BioHash inválido - deve ter pelo menos 32 caracteres');
    }

    // ADICIONAR: Validação de formato hexadecimal
    if (!/^[a-fA-F0-9]+$/.test(bioHash)) {
      throw new Error('BioHash deve conter apenas caracteres hexadecimais (0-9, a-f)');
    }

    // ADICIONAR: Validação de entropia mínima
    const analysis = this.analyzeBioHashQuality(bioHash);
    if (analysis.entropy < 4.0) {
      throw new Error('BioHash com entropia muito baixa - pode ser previsível');
    }

    const {
      salt = this.DEFAULT_SALT,
      iterations = this.DEFAULT_ITERATIONS,
      keyLength = this.DEFAULT_KEY_LENGTH
    } = options;

    try {
      // 1. Combina bioHash com salt para criar material base
      const baseMaterial = `${bioHash}:${salt}`;
      
      // 2. Deriva uma chave usando PBKDF2 para adicionar segurança computacional
      const derivedKey = CryptoJS.PBKDF2(baseMaterial, salt, {
        keySize: keyLength / 4, // CryptoJS usa words de 4 bytes
        iterations: iterations,
        hasher: CryptoJS.algo.SHA256
      });

      // 3. Converte para hex string
      const keyHex = derivedKey.toString(CryptoJS.enc.Hex);
      
      // 4. Garante que temos exatamente 32 bytes (64 hex chars)
      const privateKeyHex = keyHex.padStart(64, '0').slice(0, 64);
      
      // 5. Cria a wallet a partir da chave privada
      const wallet = new ethers.Wallet(`0x${privateKeyHex}`);
      
      return wallet;
    } catch (error) {
      console.error('Erro ao gerar wallet determinística:', error);
      throw new Error('Falha na geração da wallet: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Valida se um endereço corresponde ao bioHash fornecido
   * @param address - Endereço da wallet a ser validado
   * @param bioHash - Hash biométrico
   * @param options - Opções de geração (devem ser as mesmas usadas na criação)
   * @param identifier - Identificador para rate limiting
   * @returns True se o endereço corresponde ao bioHash
   */
  static validateAddressForBioHash(
    address: string,
    bioHash: string,
    options: WalletGenerationOptions = {},
    identifier: string = 'default'
  ): boolean {
    try {
      const wallet = this.generateWallet(bioHash, options, identifier);
      return wallet.address.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Erro na validação de endereço:', error);
      return false;
    }
  }

  /**
   * Deriva múltiplos endereços a partir do mesmo bioHash (usando HD Wallet)
   * @param bioHash - Hash biométrico base
   * @param count - Número de endereços a derivar
   * @param options - Opções de geração
   * @param identifier - Identificador para rate limiting
   * @returns Array de wallets derivadas
   */
  static deriveMultipleWallets(
    bioHash: string,
    count: number = 5,
    options: WalletGenerationOptions = {},
    identifier: string = 'default'
  ): ethers.Wallet[] {
    if (count <= 0 || count > 100) {
      throw new Error('Count deve estar entre 1 e 100');
    }

    const baseWallet = this.generateWallet(bioHash, options, identifier);
    const wallets: ethers.Wallet[] = [baseWallet];

    try {
      // Cria mnemonic a partir da chave privada base
      const entropy = baseWallet.privateKey.slice(2); // Remove '0x'
      const mnemonic = ethers.Mnemonic.entropyToPhrase(Buffer.from(entropy, 'hex').slice(0, 16));
      
      // Deriva endereços adicionais usando HD Wallet
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
      
      for (let i = 1; i < count; i++) {
        const derivedWallet = hdNode.derivePath(`m/44'/60'/0'/0/${i}`);
        wallets.push(new ethers.Wallet(derivedWallet.privateKey));
      }

      return wallets;
    } catch (error) {
      console.error('Erro na derivação de múltiplas wallets:', error);
      // Fallback: gera wallets com salt incrementado
      for (let i = 1; i < count; i++) {
        const saltedOptions = {
          ...options,
          salt: `${options.salt || this.DEFAULT_SALT}-${i}`
        };
        wallets.push(this.generateWallet(bioHash, saltedOptions, `${identifier}-${i}`));
      }
      return wallets;
    }
  }

  /**
   * Gera endereço sem criar a wallet completa (mais eficiente)
   * @param bioHash - Hash biométrico
   * @param options - Opções de geração
   * @param identifier - Identificador para rate limiting
   * @returns Endereço Ethereum
   */
  static generateAddress(
    bioHash: string,
    options: WalletGenerationOptions = {},
    identifier: string = 'default'
  ): string {
    const wallet = this.generateWallet(bioHash, options, identifier);
    return wallet.address;
  }

  /**
   * Verifica a força/entropia do bioHash fornecido
   * @param bioHash - Hash biométrico a ser verificado
   * @returns Objeto com análise da qualidade do bioHash
   */
  static analyzeBioHashQuality(bioHash: string): {
    length: number;
    entropy: number;
    isValid: boolean;
    recommendations: string[];
  } {
    const analysis = {
      length: bioHash.length,
      entropy: 0,
      isValid: false,
      recommendations: [] as string[]
    };

    // Calcula entropia simples
    const charFreq: { [key: string]: number } = {};
    for (const char of bioHash) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }

    const totalChars = bioHash.length;
    let entropy = 0;
    for (const freq of Object.values(charFreq)) {
      const prob = freq / totalChars;
      entropy -= prob * Math.log2(prob);
    }

    analysis.entropy = entropy;

    // Validações
    if (bioHash.length < 32) {
      analysis.recommendations.push('BioHash deve ter pelo menos 32 caracteres');
    }

    if (entropy < 4.0) {
      analysis.recommendations.push('Entropia baixa - bioHash pode ser previsível');
    }

    if (!/^[a-fA-F0-9]+$/.test(bioHash)) {
      analysis.recommendations.push('BioHash deve conter apenas caracteres hexadecimais');
    }

    analysis.isValid = analysis.recommendations.length === 0;

    return analysis;
  }

  /**
   * Utilitário para debug - NÃO usar em produção
   * Mostra o processo de geração para auditoria
   */
  static debugGeneration(bioHash: string, options: WalletGenerationOptions = {}): {
    bioHash: string;
    salt: string;
    iterations: number;
    derivedKey: string;
    privateKey: string;
    address: string;
    publicKey: string;
  } {
    const {
      salt = this.DEFAULT_SALT,
      iterations = this.DEFAULT_ITERATIONS,
      keyLength = this.DEFAULT_KEY_LENGTH
    } = options;

    const baseMaterial = `${bioHash}:${salt}`;
    const derivedKey = CryptoJS.PBKDF2(baseMaterial, salt, {
      keySize: keyLength / 4,
      iterations: iterations,
      hasher: CryptoJS.algo.SHA256
    });

    const keyHex = derivedKey.toString(CryptoJS.enc.Hex);
    const privateKeyHex = keyHex.padStart(64, '0').slice(0, 64);
    const wallet = new ethers.Wallet(`0x${privateKeyHex}`);

    return {
      bioHash,
      salt,
      iterations,
      derivedKey: keyHex,
      privateKey: `0x${privateKeyHex}`,
      address: wallet.address,
      publicKey: wallet.signingKey.publicKey
    };
  }
}

// Configurações de produção recomendadas
export const PRODUCTION_CONFIG: WalletGenerationOptions = {
  salt: 'blocktrust-mainnet',
  iterations: 250000, // Mais seguro para produção
  keyLength: 32
};

// Configurações de desenvolvimento/teste
export const DEVELOPMENT_CONFIG: WalletGenerationOptions = {
  salt: 'blocktrust-testnet-dev',
  iterations: 10000, // Mais rápido para desenvolvimento
  keyLength: 32
};
